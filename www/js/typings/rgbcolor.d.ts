declare class RGBColor {
    constructor(color_string: string);
    ok: boolean;
    r: number;
    g: number;
    b: number;
    toRGB(): string;
    toHex(): string;
    getHelpXML: string;
}