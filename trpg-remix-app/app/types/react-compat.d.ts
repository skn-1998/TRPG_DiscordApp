import 'react'

declare module 'react' {
  /**
   * @tabler/icons-react still imports this legacy React type.
   * It is used only to constrain SVG node names.
   */
  interface ReactSVG {
    [elementName: string]: unknown
  }
}

declare global {
  interface ImportMap {
    imports?: Record<string, string>
    scopes?: Record<string, Record<string, string>>
    integrity?: Record<string, string>
  }
}
