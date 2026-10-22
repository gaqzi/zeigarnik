// zg's $.state contract: the lines the pane draws, and the goal the session
// was last titled for with its origin. ZgLine restates src/core/overview.ts's
// Line, as a contract stands alone; tsc checks the two agree where the pane
// is drawn.

export type ZgLine = { text: string; isOpen: boolean }

declare module 'claude-code' {
  interface PluginState {
    zg: { lines: ZgLine[]; titled: string }
  }
}
