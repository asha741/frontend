import { Pipe, PipeTransform } from '@angular/core';
import MarkdownIt from 'markdown-it';

/**
 * Renders markdown (the format the AI writes failure reasons / recommendations
 * in) to HTML for `[innerHTML]`.
 *
 * `html: false` means raw HTML inside the markdown source is escaped rather
 * than passed through, and Angular's own sanitizer still runs over the result
 * of `[innerHTML]` — so no `bypassSecurityTrustHtml` is needed anywhere.
 *
 * The pipe is pure, so a given string is parsed once and the result reused on
 * later change-detection passes.
 *
 * @example
 *   <div [innerHTML]="rule.failure_reason | markdown"></div>
 */
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  private readonly md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
  });

  /**
   * @param value raw markdown source (or nullish)
   * @returns rendered HTML string, or '' if value is nullish/empty
   */
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return this.md.render(value);
  }
}
