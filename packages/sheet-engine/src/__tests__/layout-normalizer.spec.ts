import { normalizeTemplateLayout } from '..';

const layoutNormalizationFixtures = jest.requireActual('../../fixtures/layout-normalization.json') as Array<{
  name: string;
  input: unknown;
  expected: unknown;
}>;

describe('normalizeTemplateLayout', () => {
  it.each(layoutNormalizationFixtures)('$name', ({ input, expected }) => {
    const original = structuredClone(input);

    const normalized = normalizeTemplateLayout(input);

    expect(normalized).toEqual(expected);
    expect(normalizeTemplateLayout(normalized)).toEqual(normalized);
    expect(input).toEqual(original);
  });
});
