const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const PAGE_CHAR_SIZE = 2500;

function chunkIntoPages(text) {
    const clean = text.replace(/\r\n/g, "\n").trim();
    const pages = [];
    let index = 0;
    let pageNumber = 1;

    while (index < clean.length) {
        const slice = clean.slice(index, index + PAGE_CHAR_SIZE);
        pages.push({ page: pageNumber, text: slice.trim() });
        index += PAGE_CHAR_SIZE;
        pageNumber += 1;
    }

    return pages.length ? pages : [{ page: 1, text: clean }];
}

async function extractPdf(filePath) {
    const buffer = fs.readFileSync(filePath);
    const pages = [];

    await pdfParse(buffer, {
        pagerender: (pageData) => {
            return pageData
                .getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
                .then((textContent) => {
                    const text = textContent.items.map((item) => item.str).join(" ");
                    pages.push({ page: pages.length + 1, text: text.trim() });
                    return text;
                });
        },
    });

    return pages.length ? pages : chunkIntoPages("");
}

async function extractDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return chunkIntoPages(result.value || "");
}

async function extractTxt(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    return chunkIntoPages(content);
}

async function extractDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    let pages;
    if (ext === ".pdf") {
        pages = await extractPdf(filePath);
    } else if (ext === ".docx") {
        pages = await extractDocx(filePath);
    } else {
        pages = await extractTxt(filePath);
    }

    const fullText = pages.map((p) => p.text).join("\n\n");

    return { pages, fullText };
}

module.exports = extractDocument;
