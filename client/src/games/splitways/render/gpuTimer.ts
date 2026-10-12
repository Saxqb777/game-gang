/**
 * GPU frame time from EXT_disjoint_timer_query_webgl2. One TIME_ELAPSED query wraps the whole frame
 * (such queries cannot nest, and three.js issues none itself). Results arrive a few frames late, so
 * a ring of queries is in flight and poll() never blocks. Without the extension (SwiftShader, some
 * mobile and Metal drivers) every method is a no-op and the resolution controller steers on missed
 * frames instead.
 */

/** Not in TypeScript's lib.dom yet. */
interface TimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}
const TIME_ELAPSED_EXT = 0x88bf;
const GPU_DISJOINT_EXT = 0x8fbb;
const RING_SIZE = 4;

export class GpuTimer {
  readonly supported: boolean;
  private readonly queries: WebGLQuery[] = [];
  /** Queries waiting for their result, oldest first. */
  private readonly pending: WebGLQuery[] = [];
  private readonly free: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    const extension = gl.getExtension(
      'EXT_disjoint_timer_query_webgl2',
    ) as TimerQueryExtension | null;
    this.supported = extension !== null;
    if (this.supported) {
      for (let i = 0; i < RING_SIZE; i++) {
        const query = gl.createQuery();
        this.queries.push(query);
        this.free.push(query);
      }
    }
  }

  /** Starts timing a frame; skipped when every query is still waiting for its result. */
  begin(): void {
    if (!this.supported || this.active) return;
    const query = this.free.pop();
    if (!query) return;
    this.gl.beginQuery(TIME_ELAPSED_EXT, query);
    this.active = query;
  }

  end(): void {
    if (!this.active) return;
    this.gl.endQuery(TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** The newest finished result in ms, or null when nothing new finished. Never blocks. */
  poll(): number | null {
    if (!this.supported || this.pending.length === 0) return null;
    const gl = this.gl;
    // A disjoint event (clock change, GPU reset) makes every result in flight meaningless.
    if (gl.getParameter(GPU_DISJOINT_EXT)) {
      for (const query of this.pending) this.free.push(query);
      this.pending.length = 0;
      return null;
    }
    let newest: number | null = null;
    while (this.pending.length > 0) {
      const query = this.pending[0] as WebGLQuery;
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
      newest = ns / 1e6;
      this.pending.shift();
      this.free.push(query);
    }
    return newest;
  }

  dispose(): void {
    if (this.active) this.gl.endQuery(TIME_ELAPSED_EXT);
    for (const query of this.queries) this.gl.deleteQuery(query);
    this.queries.length = 0;
    this.pending.length = 0;
    this.free.length = 0;
    this.active = null;
  }
}
