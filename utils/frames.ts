import { expect, Frame, Page } from '@playwright/test';

export async function waitForFrame(
  host: Page,
  predicate: (frame: Frame) => boolean,
  description: string,
): Promise<Frame> {
  let matched: Frame | undefined;
  await expect
    .poll(
      () => {
        matched = host.frames().find(predicate);
        return Boolean(matched);
      },
      { message: `Expected ${description} frame`, timeout: 30_000 },
    )
    .toBe(true);
  return matched!;
}
