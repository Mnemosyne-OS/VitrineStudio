import { base64Bytes, base64ToBytes, dataUrlBytes, dataUrlText, utf8Base64 } from './bytes';

describe('bytes', () => {
  it('counts the bytes of a base64 string, padding taken off', () => {
    expect(base64Bytes(btoa('a'))).toBe(1);
    expect(base64Bytes(btoa('ab'))).toBe(2);
    expect(base64Bytes(btoa('abc'))).toBe(3);
    expect(dataUrlBytes(`data:text/plain;base64,${btoa('abcd')}`)).toBe(4);
  });

  it('round-trips UTF-8 text through base64 and a data URL', () => {
    const text = '<svg>café ✓</svg>';
    const b64 = utf8Base64(text);
    expect(base64ToBytes(b64)).toHaveLength(new TextEncoder().encode(text).length);
    expect(dataUrlText(`data:image/svg+xml;base64,${b64}`)).toBe(text);
  });
});
