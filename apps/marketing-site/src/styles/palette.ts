import palette from "@jamesryan/ui/styles/palette.css?raw";

// Satori requires an sRGB colour; olive-950 is stored in that form in the palette.
export const socialBackground = palette.match(/--color-olive-950:\s*(#[0-9a-f]{6})/i)![1];
