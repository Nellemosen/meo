/* ==========================================================================
   core/post.js – Render pipeline extras:
   • Shadow map (sun, follows the player, texel-snapped, PCF in the lit shader)
   • MSAA scene buffer
   • Bloom (bright pass + separable blur at 1/4 resolution)
   • Colour grading: soft tone curve, warm highlights, cool shadows, saturation, vignette
   Everything can be switched off in Options → Graphics (gfx.shadows / gfx.post).
   ========================================================================== */
(function () {
  'use strict';

  const MEO = window.MEO;
  const GL = MEO.GL;
  const M4 = GL.M4;

  const FS_QUAD_VS = [
    '#version 300 es',
    'out vec2 v_uv;',
    'void main(){',
    '  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));',
    '  v_uv = p;',
    '  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  const DEPTH_VS = [
    '#version 300 es',
    'layout(location=0) in vec3 a_pos;',
    'uniform mat4 u_vp; uniform mat4 u_model;',
    'void main(){ gl_Position = u_vp * u_model * vec4(a_pos, 1.0); }'
  ].join('\n');
  const DEPTH_FS = ['#version 300 es', 'precision mediump float;', 'void main(){}'].join('\n');

  const BRIGHT_FS = [
    '#version 300 es', 'precision highp float;',
    'in vec2 v_uv; uniform sampler2D u_tex; out vec4 o;',
    'void main(){',
    '  vec3 c = texture(u_tex, v_uv).rgb;',
    '  float l = max(c.r, max(c.g, c.b));',
    '  float k = smoothstep(0.62, 1.0, l);',
    '  o = vec4(c * k, 1.0);',
    '}'
  ].join('\n');

  const BLUR_FS = [
    '#version 300 es', 'precision highp float;',
    'in vec2 v_uv; uniform sampler2D u_tex; uniform vec2 u_dir; out vec4 o;',
    'void main(){',
    '  vec3 c = texture(u_tex, v_uv).rgb * 0.227027;',
    '  c += texture(u_tex, v_uv + u_dir * 1.3846).rgb * 0.316216 + texture(u_tex, v_uv - u_dir * 1.3846).rgb * 0.316216;',
    '  c += texture(u_tex, v_uv + u_dir * 3.2308).rgb * 0.070270 + texture(u_tex, v_uv - u_dir * 3.2308).rgb * 0.070270;',
    '  o = vec4(c, 1.0);',
    '}'
  ].join('\n');

  const GRADE_FS = [
    '#version 300 es', 'precision highp float;',
    'in vec2 v_uv; uniform sampler2D u_tex; uniform sampler2D u_bloom; uniform float u_bloomAmt; uniform vec2 u_res; out vec4 o;',
    'void main(){',
    '  vec3 c = texture(u_tex, v_uv).rgb;',
    '  c += texture(u_bloom, v_uv).rgb * u_bloomAmt;',
    '  float l = dot(c, vec3(0.299, 0.587, 0.114));',
    // lift: cool, slightly blue-green shadows / warm gold highlights (the Middle-earth look)
    '  vec3 shadowTint = vec3(0.93, 1.0, 1.08);',
    '  vec3 lightTint = vec3(1.06, 1.015, 0.93);',
    '  c *= mix(shadowTint, lightTint, smoothstep(0.15, 0.75, l));',
    // saturation + gentle S-curve
    '  c = mix(vec3(l), c, 0.96);',
    '  c = c * c * (3.0 - 2.0 * c) * 0.5 + c * 0.5;',
    '  c = c * 1.04 + 0.006;',
    // soft vignette
    '  vec2 q = v_uv - 0.5;',
    '  float vg = smoothstep(0.95, 0.28, length(q * vec2(1.0, 0.9)));',
    '  c *= mix(0.74, 1.0, vg);',
    // tiny dither against banding
    '  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '  c += (n - 0.5) / 255.0;',
    '  o = vec4(clamp(c, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  const Post = (MEO.Post = {
    ok: false,
    shadowOn: true,
    postOn: true,
    size: 2048,
    radius: 34,
    lvp: M4.create(),
    center: new Float32Array(3),
    _w: 0,
    _h: 0,

    init(gl) {
      Post.gl = gl;
      try {
        Post.depth = GL.compile(DEPTH_VS, DEPTH_FS, 'u_vp u_model');
        Post.bright = GL.compile(FS_QUAD_VS, BRIGHT_FS, 'u_tex');
        Post.blur = GL.compile(FS_QUAD_VS, BLUR_FS, 'u_tex u_dir');
        Post.grade = GL.compile(FS_QUAD_VS, GRADE_FS, 'u_tex u_bloom u_bloomAmt u_res');
        Post._makeShadow(Post.size);
        Post.ok = true;
      } catch (err) {
        console.warn('[Post] disabled:', err.message);
        Post.ok = false;
      }
    },

    // ---- Settings -----------------------------------------------------------
    refreshSettings() {
      const S = MEO.Settings;
      Post.shadowOn = Post.ok && (!S || S.get('gfx.shadows') !== 'off');
      Post.postOn = Post.ok && (!S || S.get('gfx.post') !== false);
      const want = S && S.get('gfx.shadows') === 'high' ? 4096 : 2048;
      if (Post.ok && want !== Post.size) {
        Post.size = want;
        Post._makeShadow(want);
      }
    },

    // ---- Shadow map ------------------------------------------------------------
    _makeShadow(size) {
      const gl = Post.gl;
      if (Post.shTex) gl.deleteTexture(Post.shTex);
      if (Post.shFbo) gl.deleteFramebuffer(Post.shFbo);
      Post.shTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, Post.shTex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      Post.shFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, Post.shFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, Post.shTex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('shadow framebuffer incomplete');
    },

    /** Compute the sun's view-projection around the focus point (meters). */
    updateLight(sun, focus) {
      const r = Post.radius;
      const texel = (2 * r) / Post.size;
      const V = M4.create();
      const ex = sun[0] * 160, ey = sun[1] * 160, ez = sun[2] * 160;
      M4.lookAt(V, ex, ey, ez, 0, 0, 0, 0, 1, 0);
      const lx = V[0] * focus[0] + V[4] * focus[1] + V[8] * focus[2] + V[12];
      const ly = V[1] * focus[0] + V[5] * focus[1] + V[9] * focus[2] + V[13];
      const lz = V[2] * focus[0] + V[6] * focus[1] + V[10] * focus[2] + V[14];
      const sx = Math.round(lx / texel) * texel;
      const sy = Math.round(ly / texel) * texel;
      const near = -lz - 70, far = -lz + 70;
      const l = sx - r, rt = sx + r, b = sy - r, t = sy + r;
      const P = new Float32Array(16);
      P[0] = 2 / (rt - l);
      P[5] = 2 / (t - b);
      P[10] = -2 / (far - near);
      P[12] = -(rt + l) / (rt - l);
      P[13] = -(t + b) / (t - b);
      P[14] = -(far + near) / (far - near);
      P[15] = 1;
      M4.multiply(Post.lvp, P, V);
      Post.center[0] = focus[0];
      Post.center[1] = focus[1];
      Post.center[2] = focus[2];
    },

    beginShadow() {
      const gl = Post.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, Post.shFbo);
      gl.viewport(0, 0, Post.size, Post.size);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.colorMask(false, false, false, false);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(2.0, 4.0);
      gl.useProgram(Post.depth.prog);
      gl.uniformMatrix4fv(Post.depth.u.u_vp, false, Post.lvp);
      gl.uniformMatrix4fv(Post.depth.u.u_model, false, MEO.Renderer.identity);
    },

    setModel(mat) {
      Post.gl.uniformMatrix4fv(Post.depth.u.u_model, false, mat);
    },

    endShadow() {
      const gl = Post.gl;
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    /** Bind the shadow map + matrices on the lit program (call after useProgram(lit)). */
    bindShadowUniforms(u) {
      const gl = Post.gl;
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, Post.shTex);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u.u_shadow, 5);
      gl.uniformMatrix4fv(u.u_lvp, false, Post.lvp);
      gl.uniform1f(u.u_shOn, Post.shadowOn ? 1 : 0);
      gl.uniform1f(u.u_texel, 1 / Post.size);
      gl.uniform3fv(u.u_shCenter, Post.center);
      gl.uniform1f(u.u_shRad, Post.radius * 0.97);
    },

    // ---- Scene buffer ------------------------------------------------------------
    _tex(w, h) {
      const gl = Post.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    },

    _free() {
      const gl = Post.gl;
      ['msFbo', 'rsFbo', 'bAFbo', 'bBFbo'].forEach(function (k) {
        if (Post[k]) gl.deleteFramebuffer(Post[k]);
        Post[k] = null;
      });
      ['msColor', 'msDepth'].forEach(function (k) {
        if (Post[k]) gl.deleteRenderbuffer(Post[k]);
        Post[k] = null;
      });
      ['rsTex', 'bATex', 'bBTex'].forEach(function (k) {
        if (Post[k]) gl.deleteTexture(Post[k]);
        Post[k] = null;
      });
    },

    resize(w, h) {
      if (!Post.ok) return;
      if (w === Post._w && h === Post._h && Post.rsFbo) return;
      const gl = Post.gl;
      Post._w = w;
      Post._h = h;
      Post._free();
      const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
      Post.msFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, Post.msFbo);
      Post.msColor = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, Post.msColor);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, Post.msColor);
      Post.msDepth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, Post.msDepth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, Post.msDepth);
      const ok1 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

      Post.rsTex = Post._tex(w, h);
      Post.rsFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, Post.rsFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, Post.rsTex, 0);
      const ok2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

      const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
      Post._bw = bw;
      Post._bh = bh;
      Post.bATex = Post._tex(bw, bh);
      Post.bAFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, Post.bAFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, Post.bATex, 0);
      Post.bBTex = Post._tex(bw, bh);
      Post.bBFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, Post.bBFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, Post.bBTex, 0);
      const ok3 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!(ok1 && ok2 && ok3)) {
        console.warn('[Post] framebuffer incomplete – post effects off');
        Post._free();
        Post.ok = false;
        Post.shadowOn = false;
        Post.postOn = false;
      }
    },

    /** Start drawing the scene (into the MSAA buffer when post is on). */
    beginScene() {
      const gl = Post.gl;
      if (Post.postOn && Post.msFbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, Post.msFbo);
        return true;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return false;
    },

    /** Resolve MSAA, bloom and colour-grade to the canvas. */
    endScene() {
      const gl = Post.gl;
      if (!(Post.postOn && Post.msFbo)) return;
      const w = Post._w, h = Post._h;
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      gl.bindVertexArray(null);
      // resolve
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, Post.msFbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, Post.rsFbo);
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // bright pass → A
      gl.viewport(0, 0, Post._bw, Post._bh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, Post.bAFbo);
      gl.useProgram(Post.bright.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, Post.rsTex);
      gl.uniform1i(Post.bright.u.u_tex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // blur A→B (horizontal), B→A (vertical), twice
      gl.useProgram(Post.blur.prog);
      gl.uniform1i(Post.blur.u.u_tex, 0);
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, Post.bBFbo);
        gl.bindTexture(gl.TEXTURE_2D, Post.bATex);
        gl.uniform2f(Post.blur.u.u_dir, (1 + i) / Post._bw, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, Post.bAFbo);
        gl.bindTexture(gl.TEXTURE_2D, Post.bBTex);
        gl.uniform2f(Post.blur.u.u_dir, 0, (1 + i) / Post._bh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // grade → canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(Post.grade.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, Post.rsTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, Post.bATex);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(Post.grade.u.u_tex, 0);
      gl.uniform1i(Post.grade.u.u_bloom, 1);
      gl.uniform1f(Post.grade.u.u_bloomAmt, 0.28);
      gl.uniform2f(Post.grade.u.u_res, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
    }
  });
})();
