import QRCode from "qrcode";
function crc16Checksum(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            }
            else {
                crc <<= 1;
            }
        }
    }
    return ((crc & 0xFFFF).toString(16)).toUpperCase().padStart(4, "0");
}
function addField(id, value) {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
}
function sanitize(value, maxLen) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9\s\-\.\,\/\(\)]/g, "")
        .trim()
        .slice(0, maxLen);
}
function buildPayload(merchantAccountInfo, merchantName, merchantCity, additionalData, value) {
    let p = addField("00", "01") +
        addField("26", merchantAccountInfo) +
        addField("52", "0000") +
        addField("53", "986");
    if (value !== undefined) {
        p += addField("54", value.toFixed(2));
    }
    p +=
        addField("58", "BR") +
            addField("59", sanitize(merchantName, 25)) +
            addField("60", sanitize(merchantCity, 15)) +
            addField("62", additionalData) +
            "6304";
    return p;
}
export function generatePixPayload(pixKey, merchantName, merchantCity, txId) {
    const payloadKey = addField("01", pixKey);
    const merchantAccountInfo = addField("00", "br.gov.bcb.pix") + payloadKey;
    const txIdFormatted = (txId || "***").slice(0, 25);
    const additionalData = addField("05", txIdFormatted);
    const withoutCRC = buildPayload(merchantAccountInfo, merchantName, merchantCity, additionalData);
    const checksum = crc16Checksum(withoutCRC);
    return withoutCRC + checksum;
}
export function generatePixPayloadWithValue(pixKey, value, merchantName, merchantCity, txId) {
    const payloadKey = addField("01", pixKey);
    const merchantAccountInfo = addField("00", "br.gov.bcb.pix") + payloadKey;
    const txIdFormatted = (txId || "***").slice(0, 25);
    const additionalData = addField("05", txIdFormatted);
    const withoutCRC = buildPayload(merchantAccountInfo, merchantName, merchantCity, additionalData, value);
    const checksum = crc16Checksum(withoutCRC);
    return withoutCRC + checksum;
}
export async function generatePixQRCode(pixPayload) {
    return QRCode.toBuffer(pixPayload, {
        type: "png",
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
    });
}
