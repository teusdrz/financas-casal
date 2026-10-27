/** Contrato comum dos controllers de pagina. */
export interface PageController {
  render(content: HTMLElement): Promise<void>;
}
