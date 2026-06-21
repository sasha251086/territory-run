import { serializeForJson } from './json-serialize.util';

describe('serializeForJson', () => {
  it('should convert BigInt values to strings', () => {
    const result = serializeForJson({
      totalDistance: BigInt(12345),
      nested: { value: BigInt(99) },
    });

    expect(result).toEqual({
      totalDistance: '12345',
      nested: { value: '99' },
    });
  });
});
