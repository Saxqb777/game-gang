/**
 * Exponential fog that takes the colour of the sky behind each fragment instead of one flat colour,
 * so distant dunes, towers and sea fade into the horizon in every direction (bright towards the
 * sun, deeper blue away from it). Replaces three.js's fog shader chunks; linear fog is unchanged.
 */
import { ShaderChunk, type Color } from 'three';

const vec3 = (c: Color) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

/** `colours`: sky colour at the horizon around the compass (see Sky.hazeColours). */
export function installHaze(colours: readonly Color[]): void {
  const n = colours.length;
  ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  #ifdef FOG_EXP2
    varying vec3 vFogDirection;
  #endif
#endif`;

  ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  #ifdef FOG_EXP2
    // Camera-to-vertex direction in world space (the view matrix's rotation is orthonormal).
    vFogDirection = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
  #endif
#endif`;

  ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  #ifdef FOG_EXP2
    uniform float fogDensity;
    varying vec3 vFogDirection;
    const vec3 HAZE[${n}] = vec3[${n}](${colours.map(vec3).join(', ')});
    vec3 hazeColour( vec3 direction ) {
      float x = ( atan( direction.z, direction.x ) * 0.15915494 + 0.5 ) * ${n}.0 - 0.5;
      float i = floor( x );
      return mix( HAZE[ int( mod( i, ${n}.0 ) ) ], HAZE[ int( mod( i + 1.0, ${n}.0 ) ) ], x - i );
    }
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;

  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor * hazeColour( vFogDirection ), fogFactor );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif
#endif`;
}
