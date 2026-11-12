import palette from "@jamesryan/ui/styles/palette.css?raw";

// Satori needs sRGB values and a plain background-image, so the shared social
// gradient is stored in that form in the palette.
export const socialBackground = palette.match(/--social-background:\s*(linear-gradient\([^;]+\));/i)![1];
