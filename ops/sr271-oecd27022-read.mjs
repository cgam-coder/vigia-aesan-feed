// ../verify/node_modules/fast-xml-parser/src/util.js
var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
var regexName = new RegExp("^" + nameRegexp + "$");
function getAllMatches(string, regex) {
  const matches = [];
  let match = regex.exec(string);
  while (match) {
    const allmatches = [];
    allmatches.startIndex = regex.lastIndex - match[0].length;
    const len = match.length;
    for (let index = 0; index < len; index++) {
      allmatches.push(match[index]);
    }
    matches.push(allmatches);
    match = regex.exec(string);
  }
  return matches;
}
var isName = function(string) {
  const match = regexName.exec(string);
  return !(match === null || typeof match === "undefined");
};
function isExist(v) {
  return typeof v !== "undefined";
}
var DANGEROUS_PROPERTY_NAMES = [
  // '__proto__',
  // 'constructor',
  // 'prototype',
  "hasOwnProperty",
  "toString",
  "valueOf",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__"
];
var criticalProperties = ["__proto__", "constructor", "prototype"];

// ../verify/node_modules/fast-xml-parser/src/validator.js
var defaultOptions = {
  allowBooleanAttributes: false,
  //A tag can have attributes without any value
  unpairedTags: []
};
function validate(xmlData, options) {
  options = Object.assign({}, defaultOptions, options);
  const tags = [];
  let tagFound = false;
  let reachedRoot = false;
  if (xmlData[0] === "\uFEFF") {
    xmlData = xmlData.substr(1);
  }
  for (let i = 0; i < xmlData.length; i++) {
    if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
      i += 2;
      i = readPI(xmlData, i);
      if (i.err) return i;
    } else if (xmlData[i] === "<") {
      let tagStartPos = i;
      i++;
      if (xmlData[i] === "!") {
        i = readCommentAndCDATA(xmlData, i);
        continue;
      } else {
        let closingTag = false;
        if (xmlData[i] === "/") {
          closingTag = true;
          i++;
        }
        let tagName = "";
        for (; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++) {
          tagName += xmlData[i];
        }
        tagName = tagName.trim();
        if (tagName[tagName.length - 1] === "/") {
          tagName = tagName.substring(0, tagName.length - 1);
          i--;
        }
        if (!validateTagName(tagName)) {
          let msg;
          if (tagName.trim().length === 0) {
            msg = "Invalid space after '<'.";
          } else {
            msg = "Tag '" + tagName + "' is an invalid name.";
          }
          return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
        }
        const result = readAttributeStr(xmlData, i);
        if (result === false) {
          return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
        }
        let attrStr = result.value;
        i = result.index;
        if (attrStr[attrStr.length - 1] === "/") {
          const attrStrStart = i - attrStr.length;
          attrStr = attrStr.substring(0, attrStr.length - 1);
          const isValid = validateAttributeString(attrStr, options);
          if (isValid === true) {
            tagFound = true;
          } else {
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
          }
        } else if (closingTag) {
          if (!result.tagClosed) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
          } else if (attrStr.trim().length > 0) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
          } else if (tags.length === 0) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
          } else {
            const otg = tags.pop();
            if (tagName !== otg.tagName) {
              let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
              return getErrorObject(
                "InvalidTag",
                "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                getLineNumberForPosition(xmlData, tagStartPos)
              );
            }
            if (tags.length == 0) {
              reachedRoot = true;
            }
          }
        } else {
          const isValid = validateAttributeString(attrStr, options);
          if (isValid !== true) {
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
          }
          if (reachedRoot === true) {
            return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
          } else if (options.unpairedTags.indexOf(tagName) !== -1) {
          } else {
            tags.push({ tagName, tagStartPos });
          }
          tagFound = true;
        }
        for (i++; i < xmlData.length; i++) {
          if (xmlData[i] === "<") {
            if (xmlData[i + 1] === "!") {
              i++;
              i = readCommentAndCDATA(xmlData, i);
              continue;
            } else if (xmlData[i + 1] === "?") {
              i = readPI(xmlData, ++i);
              if (i.err) return i;
            } else {
              break;
            }
          } else if (xmlData[i] === "&") {
            const afterAmp = validateAmpersand(xmlData, i);
            if (afterAmp == -1)
              return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
            i = afterAmp;
          } else {
            if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
              return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i));
            }
          }
        }
        if (xmlData[i] === "<") {
          i--;
        }
      }
    } else {
      if (isWhiteSpace(xmlData[i])) {
        continue;
      }
      return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
    }
  }
  if (!tagFound) {
    return getErrorObject("InvalidXml", "Start tag expected.", 1);
  } else if (tags.length == 1) {
    return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
  } else if (tags.length > 0) {
    return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
  }
  return true;
}
function isWhiteSpace(char) {
  return char === " " || char === "	" || char === "\n" || char === "\r";
}
function readPI(xmlData, i) {
  const start = i;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] == "?" || xmlData[i] == " ") {
      const tagname = xmlData.substr(start, i - start);
      if (i > 5 && tagname === "xml") {
        return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
      } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
        i++;
        break;
      } else {
        continue;
      }
    }
  }
  return i;
}
function readCommentAndCDATA(xmlData, i) {
  if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
    for (i += 3; i < xmlData.length; i++) {
      if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
        i += 2;
        break;
      }
    }
  } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
    let angleBracketsCount = 1;
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === "<") {
        angleBracketsCount++;
      } else if (xmlData[i] === ">") {
        angleBracketsCount--;
        if (angleBracketsCount === 0) {
          break;
        }
      }
    }
  } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
        i += 2;
        break;
      }
    }
  }
  return i;
}
var doubleQuote = '"';
var singleQuote = "'";
function readAttributeStr(xmlData, i) {
  let attrStr = "";
  let startChar = "";
  let tagClosed = false;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
      if (startChar === "") {
        startChar = xmlData[i];
      } else if (startChar !== xmlData[i]) {
      } else {
        startChar = "";
      }
    } else if (xmlData[i] === ">") {
      if (startChar === "") {
        tagClosed = true;
        break;
      }
    }
    attrStr += xmlData[i];
  }
  if (startChar !== "") {
    return false;
  }
  return {
    value: attrStr,
    index: i,
    tagClosed
  };
}
var validAttrStrRegxp = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
function validateAttributeString(attrStr, options) {
  const matches = getAllMatches(attrStr, validAttrStrRegxp);
  const attrNames = {};
  for (let i = 0; i < matches.length; i++) {
    if (matches[i][1].length === 0) {
      return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
    } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
      return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
    } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
      return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
    }
    const attrName = matches[i][2];
    if (!validateAttrName(attrName)) {
      return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
    }
    if (!Object.prototype.hasOwnProperty.call(attrNames, attrName)) {
      attrNames[attrName] = 1;
    } else {
      return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
    }
  }
  return true;
}
function validateNumberAmpersand(xmlData, i) {
  let re = /\d/;
  if (xmlData[i] === "x") {
    i++;
    re = /[\da-fA-F]/;
  }
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === ";")
      return i;
    if (!xmlData[i].match(re))
      break;
  }
  return -1;
}
function validateAmpersand(xmlData, i) {
  i++;
  if (xmlData[i] === ";")
    return -1;
  if (xmlData[i] === "#") {
    i++;
    return validateNumberAmpersand(xmlData, i);
  }
  let count = 0;
  for (; i < xmlData.length; i++, count++) {
    if (xmlData[i].match(/\w/) && count < 20)
      continue;
    if (xmlData[i] === ";")
      break;
    return -1;
  }
  return i;
}
function getErrorObject(code, message, lineNumber) {
  return {
    err: {
      code,
      msg: message,
      line: lineNumber.line || lineNumber,
      col: lineNumber.col
    }
  };
}
function validateAttrName(attrName) {
  return isName(attrName);
}
function validateTagName(tagname) {
  return isName(tagname);
}
function getLineNumberForPosition(xmlData, index) {
  const lines = xmlData.substring(0, index).split(/\r?\n/);
  return {
    line: lines.length,
    // column number is last line's length + 1, because column numbering starts at 1:
    col: lines[lines.length - 1].length + 1
  };
}
function getPositionFromMatch(match) {
  return match.startIndex + match[1].length;
}

// ../verify/node_modules/@nodable/entities/src/entities.js
var BASIC_LATIN = {
  amp: "&",
  AMP: "&",
  lt: "<",
  LT: "<",
  gt: ">",
  GT: ">",
  quot: '"',
  QUOT: '"',
  apos: "'",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquor: "\u201A",
  rsquor: "\u2019",
  ldquor: "\u201E",
  bdquo: "\u201E",
  comma: ",",
  period: ".",
  colon: ":",
  semi: ";",
  excl: "!",
  quest: "?",
  num: "#",
  dollar: "$",
  percent: "%",
  ast: "*",
  commat: "@",
  lowbar: "_",
  verbar: "|",
  vert: "|",
  sol: "/",
  bsol: "\\",
  lbrace: "{",
  rbrace: "}",
  lbrack: "[",
  rbrack: "]",
  lpar: "(",
  rpar: ")",
  nbsp: "\xA0",
  iexcl: "\xA1",
  cent: "\xA2",
  pound: "\xA3",
  curren: "\xA4",
  yen: "\xA5",
  brvbar: "\xA6",
  sect: "\xA7",
  uml: "\xA8",
  copy: "\xA9",
  COPY: "\xA9",
  ordf: "\xAA",
  laquo: "\xAB",
  not: "\xAC",
  shy: "\xAD",
  reg: "\xAE",
  REG: "\xAE",
  macr: "\xAF",
  deg: "\xB0",
  plusmn: "\xB1",
  sup2: "\xB2",
  sup3: "\xB3",
  acute: "\xB4",
  micro: "\xB5",
  para: "\xB6",
  middot: "\xB7",
  cedil: "\xB8",
  sup1: "\xB9",
  ordm: "\xBA",
  raquo: "\xBB",
  frac14: "\xBC",
  frac12: "\xBD",
  half: "\xBD",
  frac34: "\xBE",
  iquest: "\xBF",
  times: "\xD7",
  div: "\xF7",
  divide: "\xF7"
};
var LATIN_ACCENTS = {
  Agrave: "\xC0",
  agrave: "\xE0",
  Aacute: "\xC1",
  aacute: "\xE1",
  Acirc: "\xC2",
  acirc: "\xE2",
  Atilde: "\xC3",
  atilde: "\xE3",
  Auml: "\xC4",
  auml: "\xE4",
  Aring: "\xC5",
  aring: "\xE5",
  AElig: "\xC6",
  aelig: "\xE6",
  Ccedil: "\xC7",
  ccedil: "\xE7",
  Egrave: "\xC8",
  egrave: "\xE8",
  Eacute: "\xC9",
  eacute: "\xE9",
  Ecirc: "\xCA",
  ecirc: "\xEA",
  Euml: "\xCB",
  euml: "\xEB",
  Igrave: "\xCC",
  igrave: "\xEC",
  Iacute: "\xCD",
  iacute: "\xED",
  Icirc: "\xCE",
  icirc: "\xEE",
  Iuml: "\xCF",
  iuml: "\xEF",
  ETH: "\xD0",
  eth: "\xF0",
  Ntilde: "\xD1",
  ntilde: "\xF1",
  Ograve: "\xD2",
  ograve: "\xF2",
  Oacute: "\xD3",
  oacute: "\xF3",
  Ocirc: "\xD4",
  ocirc: "\xF4",
  Otilde: "\xD5",
  otilde: "\xF5",
  Ouml: "\xD6",
  ouml: "\xF6",
  Oslash: "\xD8",
  oslash: "\xF8",
  Ugrave: "\xD9",
  ugrave: "\xF9",
  Uacute: "\xDA",
  uacute: "\xFA",
  Ucirc: "\xDB",
  ucirc: "\xFB",
  Uuml: "\xDC",
  uuml: "\xFC",
  Yacute: "\xDD",
  yacute: "\xFD",
  THORN: "\xDE",
  thorn: "\xFE",
  szlig: "\xDF",
  yuml: "\xFF",
  Yuml: "\u0178"
};
var LATIN_EXTENDED = {
  Amacr: "\u0100",
  amacr: "\u0101",
  Abreve: "\u0102",
  abreve: "\u0103",
  Aogon: "\u0104",
  aogon: "\u0105",
  Cacute: "\u0106",
  cacute: "\u0107",
  Ccirc: "\u0108",
  ccirc: "\u0109",
  Cdot: "\u010A",
  cdot: "\u010B",
  Ccaron: "\u010C",
  ccaron: "\u010D",
  Dcaron: "\u010E",
  dcaron: "\u010F",
  Dstrok: "\u0110",
  dstrok: "\u0111",
  Emacr: "\u0112",
  emacr: "\u0113",
  Ecaron: "\u011A",
  ecaron: "\u011B",
  Edot: "\u0116",
  edot: "\u0117",
  Eogon: "\u0118",
  eogon: "\u0119",
  Gcirc: "\u011C",
  gcirc: "\u011D",
  Gbreve: "\u011E",
  gbreve: "\u011F",
  Gdot: "\u0120",
  gdot: "\u0121",
  Gcedil: "\u0122",
  Hcirc: "\u0124",
  hcirc: "\u0125",
  Hstrok: "\u0126",
  hstrok: "\u0127",
  Itilde: "\u0128",
  itilde: "\u0129",
  Imacr: "\u012A",
  imacr: "\u012B",
  Iogon: "\u012E",
  iogon: "\u012F",
  Idot: "\u0130",
  IJlig: "\u0132",
  ijlig: "\u0133",
  Jcirc: "\u0134",
  jcirc: "\u0135",
  Kcedil: "\u0136",
  kcedil: "\u0137",
  kgreen: "\u0138",
  Lacute: "\u0139",
  lacute: "\u013A",
  Lcedil: "\u013B",
  lcedil: "\u013C",
  Lcaron: "\u013D",
  lcaron: "\u013E",
  Lmidot: "\u013F",
  lmidot: "\u0140",
  Lstrok: "\u0141",
  lstrok: "\u0142",
  Nacute: "\u0143",
  nacute: "\u0144",
  Ncaron: "\u0147",
  ncaron: "\u0148",
  Ncedil: "\u0145",
  ncedil: "\u0146",
  ENG: "\u014A",
  eng: "\u014B",
  Omacr: "\u014C",
  omacr: "\u014D",
  Odblac: "\u0150",
  odblac: "\u0151",
  OElig: "\u0152",
  oelig: "\u0153",
  Racute: "\u0154",
  racute: "\u0155",
  Rcaron: "\u0158",
  rcaron: "\u0159",
  Rcedil: "\u0156",
  rcedil: "\u0157",
  Sacute: "\u015A",
  sacute: "\u015B",
  Scirc: "\u015C",
  scirc: "\u015D",
  Scedil: "\u015E",
  scedil: "\u015F",
  Scaron: "\u0160",
  scaron: "\u0161",
  Tcedil: "\u0162",
  tcedil: "\u0163",
  Tcaron: "\u0164",
  tcaron: "\u0165",
  Tstrok: "\u0166",
  tstrok: "\u0167",
  Utilde: "\u0168",
  utilde: "\u0169",
  Umacr: "\u016A",
  umacr: "\u016B",
  Ubreve: "\u016C",
  ubreve: "\u016D",
  Uring: "\u016E",
  uring: "\u016F",
  Udblac: "\u0170",
  udblac: "\u0171",
  Uogon: "\u0172",
  uogon: "\u0173",
  Wcirc: "\u0174",
  wcirc: "\u0175",
  Ycirc: "\u0176",
  ycirc: "\u0177",
  Zacute: "\u0179",
  zacute: "\u017A",
  Zdot: "\u017B",
  zdot: "\u017C",
  Zcaron: "\u017D",
  zcaron: "\u017E"
};
var GREEK = {
  Alpha: "\u0391",
  alpha: "\u03B1",
  Beta: "\u0392",
  beta: "\u03B2",
  Gamma: "\u0393",
  gamma: "\u03B3",
  Delta: "\u0394",
  delta: "\u03B4",
  Epsilon: "\u0395",
  epsilon: "\u03B5",
  epsiv: "\u03F5",
  varepsilon: "\u03F5",
  Zeta: "\u0396",
  zeta: "\u03B6",
  Eta: "\u0397",
  eta: "\u03B7",
  Theta: "\u0398",
  theta: "\u03B8",
  thetasym: "\u03D1",
  vartheta: "\u03D1",
  Iota: "\u0399",
  iota: "\u03B9",
  Kappa: "\u039A",
  kappa: "\u03BA",
  kappav: "\u03F0",
  varkappa: "\u03F0",
  Lambda: "\u039B",
  lambda: "\u03BB",
  Mu: "\u039C",
  mu: "\u03BC",
  Nu: "\u039D",
  nu: "\u03BD",
  Xi: "\u039E",
  xi: "\u03BE",
  Omicron: "\u039F",
  omicron: "\u03BF",
  Pi: "\u03A0",
  pi: "\u03C0",
  piv: "\u03D6",
  varpi: "\u03D6",
  Rho: "\u03A1",
  rho: "\u03C1",
  rhov: "\u03F1",
  varrho: "\u03F1",
  Sigma: "\u03A3",
  sigma: "\u03C3",
  sigmaf: "\u03C2",
  sigmav: "\u03C2",
  varsigma: "\u03C2",
  Tau: "\u03A4",
  tau: "\u03C4",
  Upsilon: "\u03A5",
  upsilon: "\u03C5",
  upsi: "\u03C5",
  Upsi: "\u03D2",
  upsih: "\u03D2",
  Phi: "\u03A6",
  phi: "\u03C6",
  phiv: "\u03D5",
  varphi: "\u03D5",
  Chi: "\u03A7",
  chi: "\u03C7",
  Psi: "\u03A8",
  psi: "\u03C8",
  Omega: "\u03A9",
  omega: "\u03C9",
  ohm: "\u03A9",
  Gammad: "\u03DC",
  gammad: "\u03DD",
  digamma: "\u03DD"
};
var CYRILLIC = {
  Afr: "\u{1D504}",
  afr: "\u{1D51E}",
  Acy: "\u0410",
  acy: "\u0430",
  Bcy: "\u0411",
  bcy: "\u0431",
  Vcy: "\u0412",
  vcy: "\u0432",
  Gcy: "\u0413",
  gcy: "\u0433",
  Dcy: "\u0414",
  dcy: "\u0434",
  IEcy: "\u0415",
  iecy: "\u0435",
  IOcy: "\u0401",
  iocy: "\u0451",
  ZHcy: "\u0416",
  zhcy: "\u0436",
  Zcy: "\u0417",
  zcy: "\u0437",
  Icy: "\u0418",
  icy: "\u0438",
  Jcy: "\u0419",
  jcy: "\u0439",
  Kcy: "\u041A",
  kcy: "\u043A",
  Lcy: "\u041B",
  lcy: "\u043B",
  Mcy: "\u041C",
  mcy: "\u043C",
  Ncy: "\u041D",
  ncy: "\u043D",
  Ocy: "\u041E",
  ocy: "\u043E",
  Pcy: "\u041F",
  pcy: "\u043F",
  Rcy: "\u0420",
  rcy: "\u0440",
  Scy: "\u0421",
  scy: "\u0441",
  Tcy: "\u0422",
  tcy: "\u0442",
  Ucy: "\u0423",
  ucy: "\u0443",
  Fcy: "\u0424",
  fcy: "\u0444",
  KHcy: "\u0425",
  khcy: "\u0445",
  TScy: "\u0426",
  tscy: "\u0446",
  CHcy: "\u0427",
  chcy: "\u0447",
  SHcy: "\u0428",
  shcy: "\u0448",
  SHCHcy: "\u0429",
  shchcy: "\u0449",
  HARDcy: "\u042A",
  hardcy: "\u044A",
  Ycy: "\u042B",
  ycy: "\u044B",
  SOFTcy: "\u042C",
  softcy: "\u044C",
  Ecy: "\u042D",
  ecy: "\u044D",
  YUcy: "\u042E",
  yucy: "\u044E",
  YAcy: "\u042F",
  yacy: "\u044F",
  DJcy: "\u0402",
  djcy: "\u0452",
  GJcy: "\u0403",
  gjcy: "\u0453",
  Jukcy: "\u0404",
  jukcy: "\u0454",
  DScy: "\u0405",
  dscy: "\u0455",
  Iukcy: "\u0406",
  iukcy: "\u0456",
  YIcy: "\u0407",
  yicy: "\u0457",
  Jsercy: "\u0408",
  jsercy: "\u0458",
  LJcy: "\u0409",
  ljcy: "\u0459",
  NJcy: "\u040A",
  njcy: "\u045A",
  TSHcy: "\u040B",
  tshcy: "\u045B",
  KJcy: "\u040C",
  kjcy: "\u045C",
  Ubrcy: "\u040E",
  ubrcy: "\u045E",
  DZcy: "\u040F",
  dzcy: "\u045F"
};
var MATH = {
  plus: "+",
  pm: "\xB1",
  times: "\xD7",
  div: "\xF7",
  divide: "\xF7",
  sdot: "\u22C5",
  star: "\u2606",
  starf: "\u2605",
  bigstar: "\u2605",
  lowast: "\u2217",
  ast: "*",
  midast: "*",
  compfn: "\u2218",
  smallcircle: "\u2218",
  bullet: "\u2022",
  bull: "\u2022",
  nbsp: "\xA0",
  hellip: "\u2026",
  mldr: "\u2026",
  prime: "\u2032",
  Prime: "\u2033",
  tprime: "\u2034",
  bprime: "\u2035",
  backprime: "\u2035",
  minus: "\u2212",
  minusd: "\u2238",
  dotminus: "\u2238",
  plusdo: "\u2214",
  dotplus: "\u2214",
  plusmn: "\xB1",
  minusplus: "\u2213",
  mnplus: "\u2213",
  mp: "\u2213",
  setminus: "\u2216",
  smallsetminus: "\u2216",
  Backslash: "\u2216",
  setmn: "\u2216",
  ssetmn: "\u2216",
  lowbar: "_",
  verbar: "|",
  vert: "|",
  VerticalLine: "|",
  colon: ":",
  Colon: "\u2237",
  Proportion: "\u2237",
  ratio: "\u2236",
  equals: "=",
  ne: "\u2260",
  nequiv: "\u2262",
  equiv: "\u2261",
  Congruent: "\u2261",
  sim: "\u223C",
  thicksim: "\u223C",
  thksim: "\u223C",
  sime: "\u2243",
  simeq: "\u2243",
  TildeEqual: "\u2243",
  asymp: "\u2248",
  approx: "\u2248",
  thickapprox: "\u2248",
  thkap: "\u2248",
  TildeTilde: "\u2248",
  ncong: "\u2247",
  cong: "\u2245",
  TildeFullEqual: "\u2245",
  asympeq: "\u224D",
  CupCap: "\u224D",
  bump: "\u224E",
  Bumpeq: "\u224E",
  HumpDownHump: "\u224E",
  bumpe: "\u224F",
  bumpeq: "\u224F",
  HumpEqual: "\u224F",
  le: "\u2264",
  LessEqual: "\u2264",
  ge: "\u2265",
  GreaterEqual: "\u2265",
  lesseqgtr: "\u22DA",
  lesseqqgtr: "\u2A8B",
  greater: ">",
  less: "<"
};
var MATH_ADVANCED = {
  alefsym: "\u2135",
  aleph: "\u2135",
  beth: "\u2136",
  gimel: "\u2137",
  daleth: "\u2138",
  forall: "\u2200",
  ForAll: "\u2200",
  part: "\u2202",
  PartialD: "\u2202",
  exist: "\u2203",
  Exists: "\u2203",
  nexist: "\u2204",
  nexists: "\u2204",
  empty: "\u2205",
  emptyset: "\u2205",
  emptyv: "\u2205",
  varnothing: "\u2205",
  nabla: "\u2207",
  Del: "\u2207",
  isin: "\u2208",
  isinv: "\u2208",
  in: "\u2208",
  Element: "\u2208",
  notin: "\u2209",
  notinva: "\u2209",
  ni: "\u220B",
  niv: "\u220B",
  SuchThat: "\u220B",
  ReverseElement: "\u220B",
  notni: "\u220C",
  notniva: "\u220C",
  prod: "\u220F",
  Product: "\u220F",
  coprod: "\u2210",
  Coproduct: "\u2210",
  sum: "\u2211",
  Sum: "\u2211",
  minus: "\u2212",
  mp: "\u2213",
  plusdo: "\u2214",
  dotplus: "\u2214",
  setminus: "\u2216",
  lowast: "\u2217",
  radic: "\u221A",
  Sqrt: "\u221A",
  prop: "\u221D",
  propto: "\u221D",
  Proportional: "\u221D",
  varpropto: "\u221D",
  infin: "\u221E",
  infintie: "\u29DD",
  ang: "\u2220",
  angle: "\u2220",
  angmsd: "\u2221",
  measuredangle: "\u2221",
  angsph: "\u2222",
  mid: "\u2223",
  VerticalBar: "\u2223",
  nmid: "\u2224",
  nsmid: "\u2224",
  npar: "\u2226",
  parallel: "\u2225",
  spar: "\u2225",
  nparallel: "\u2226",
  nspar: "\u2226",
  and: "\u2227",
  wedge: "\u2227",
  or: "\u2228",
  vee: "\u2228",
  cap: "\u2229",
  cup: "\u222A",
  int: "\u222B",
  Integral: "\u222B",
  conint: "\u222E",
  ContourIntegral: "\u222E",
  Conint: "\u222F",
  DoubleContourIntegral: "\u222F",
  Cconint: "\u2230",
  there4: "\u2234",
  therefore: "\u2234",
  Therefore: "\u2234",
  becaus: "\u2235",
  because: "\u2235",
  Because: "\u2235",
  ratio: "\u2236",
  Proportion: "\u2237",
  minusd: "\u2238",
  dotminus: "\u2238",
  mDDot: "\u223A",
  homtht: "\u223B",
  sim: "\u223C",
  bsimg: "\u223D",
  backsim: "\u223D",
  ac: "\u223E",
  mstpos: "\u223E",
  acd: "\u223F",
  VerticalTilde: "\u2240",
  wr: "\u2240",
  wreath: "\u2240",
  nsime: "\u2244",
  nsimeq: "\u2244",
  ncong: "\u2247",
  simne: "\u2246",
  ncongdot: "\u2A6D\u0338",
  ngsim: "\u2275",
  nsim: "\u2241",
  napprox: "\u2249",
  nap: "\u2249",
  ngeq: "\u2271",
  nge: "\u2271",
  nleq: "\u2270",
  nle: "\u2270",
  ngtr: "\u226F",
  ngt: "\u226F",
  nless: "\u226E",
  nlt: "\u226E",
  nprec: "\u2280",
  npr: "\u2280",
  nsucc: "\u2281",
  nsc: "\u2281"
};
var ARROWS = {
  larr: "\u2190",
  leftarrow: "\u2190",
  LeftArrow: "\u2190",
  uarr: "\u2191",
  uparrow: "\u2191",
  UpArrow: "\u2191",
  rarr: "\u2192",
  rightarrow: "\u2192",
  RightArrow: "\u2192",
  darr: "\u2193",
  downarrow: "\u2193",
  DownArrow: "\u2193",
  harr: "\u2194",
  leftrightarrow: "\u2194",
  LeftRightArrow: "\u2194",
  varr: "\u2195",
  updownarrow: "\u2195",
  UpDownArrow: "\u2195",
  nwarr: "\u2196",
  nwarrow: "\u2196",
  UpperLeftArrow: "\u2196",
  nearr: "\u2197",
  nearrow: "\u2197",
  UpperRightArrow: "\u2197",
  searr: "\u2198",
  searrow: "\u2198",
  LowerRightArrow: "\u2198",
  swarr: "\u2199",
  swarrow: "\u2199",
  LowerLeftArrow: "\u2199",
  lArr: "\u21D0",
  Leftarrow: "\u21D0",
  uArr: "\u21D1",
  Uparrow: "\u21D1",
  rArr: "\u21D2",
  Rightarrow: "\u21D2",
  dArr: "\u21D3",
  Downarrow: "\u21D3",
  hArr: "\u21D4",
  Leftrightarrow: "\u21D4",
  iff: "\u21D4",
  vArr: "\u21D5",
  Updownarrow: "\u21D5",
  lAarr: "\u21DA",
  Lleftarrow: "\u21DA",
  rAarr: "\u21DB",
  Rrightarrow: "\u21DB",
  lrarr: "\u21C6",
  leftrightarrows: "\u21C6",
  rlarr: "\u21C4",
  rightleftarrows: "\u21C4",
  lrhar: "\u21CB",
  leftrightharpoons: "\u21CB",
  ReverseEquilibrium: "\u21CB",
  rlhar: "\u21CC",
  rightleftharpoons: "\u21CC",
  Equilibrium: "\u21CC",
  udarr: "\u21C5",
  UpArrowDownArrow: "\u21C5",
  duarr: "\u21F5",
  DownArrowUpArrow: "\u21F5",
  llarr: "\u21C7",
  leftleftarrows: "\u21C7",
  rrarr: "\u21C9",
  rightrightarrows: "\u21C9",
  ddarr: "\u21CA",
  downdownarrows: "\u21CA",
  har: "\u21BD",
  lhard: "\u21BD",
  leftharpoondown: "\u21BD",
  lharu: "\u21BC",
  leftharpoonup: "\u21BC",
  rhard: "\u21C1",
  rightharpoondown: "\u21C1",
  rharu: "\u21C0",
  rightharpoonup: "\u21C0",
  lsh: "\u21B0",
  Lsh: "\u21B0",
  rsh: "\u21B1",
  Rsh: "\u21B1",
  ldsh: "\u21B2",
  rdsh: "\u21B3",
  hookleftarrow: "\u21A9",
  hookrightarrow: "\u21AA",
  mapstoleft: "\u21A4",
  mapstoup: "\u21A5",
  map: "\u21A6",
  mapsto: "\u21A6",
  mapstodown: "\u21A7",
  crarr: "\u21B5",
  nleftarrow: "\u219A",
  nleftrightarrow: "\u21AE",
  nrightarrow: "\u219B",
  nrarr: "\u219B",
  larrtl: "\u21A2",
  rarrtl: "\u21A3",
  leftarrowtail: "\u21A2",
  rightarrowtail: "\u21A3",
  twoheadleftarrow: "\u219E",
  twoheadrightarrow: "\u21A0",
  Larr: "\u219E",
  Rarr: "\u21A0",
  larrhk: "\u21A9",
  rarrhk: "\u21AA",
  larrlp: "\u21AB",
  looparrowleft: "\u21AB",
  rarrlp: "\u21AC",
  looparrowright: "\u21AC",
  harrw: "\u21AD",
  leftrightsquigarrow: "\u21AD",
  nrarrw: "\u219D\u0338",
  rarrw: "\u219D",
  rightsquigarrow: "\u219D",
  larrbfs: "\u291F",
  rarrbfs: "\u2920",
  nvHarr: "\u2904",
  nvlArr: "\u2902",
  nvrArr: "\u2903",
  larrfs: "\u291D",
  rarrfs: "\u291E",
  Map: "\u2905",
  larrsim: "\u2973",
  rarrsim: "\u2974",
  harrcir: "\u2948",
  Uarrocir: "\u2949",
  lurdshar: "\u294A",
  ldrdhar: "\u2967",
  ldrushar: "\u294B",
  rdldhar: "\u2969",
  lrhard: "\u296D",
  uharr: "\u21BE",
  uharl: "\u21BF",
  dharr: "\u21C2",
  dharl: "\u21C3",
  Uarr: "\u219F",
  Darr: "\u21A1",
  zigrarr: "\u21DD",
  nwArr: "\u21D6",
  neArr: "\u21D7",
  seArr: "\u21D8",
  swArr: "\u21D9",
  nharr: "\u21AE",
  nhArr: "\u21CE",
  nlarr: "\u219A",
  nlArr: "\u21CD",
  nrArr: "\u21CF",
  larrb: "\u21E4",
  LeftArrowBar: "\u21E4",
  rarrb: "\u21E5",
  RightArrowBar: "\u21E5"
};
var SHAPES = {
  square: "\u25A1",
  Square: "\u25A1",
  squ: "\u25A1",
  squf: "\u25AA",
  squarf: "\u25AA",
  blacksquar: "\u25AA",
  blacksquare: "\u25AA",
  FilledVerySmallSquare: "\u25AA",
  blk34: "\u2593",
  blk12: "\u2592",
  blk14: "\u2591",
  block: "\u2588",
  srect: "\u25AD",
  rect: "\u25AD",
  sdot: "\u22C5",
  sdotb: "\u22A1",
  dotsquare: "\u22A1",
  triangle: "\u25B5",
  tri: "\u25B5",
  trine: "\u25B5",
  utri: "\u25B5",
  triangledown: "\u25BF",
  dtri: "\u25BF",
  tridown: "\u25BF",
  triangleleft: "\u25C3",
  ltri: "\u25C3",
  triangleright: "\u25B9",
  rtri: "\u25B9",
  blacktriangle: "\u25B4",
  utrif: "\u25B4",
  blacktriangledown: "\u25BE",
  dtrif: "\u25BE",
  blacktriangleleft: "\u25C2",
  ltrif: "\u25C2",
  blacktriangleright: "\u25B8",
  rtrif: "\u25B8",
  loz: "\u25CA",
  lozenge: "\u25CA",
  blacklozenge: "\u29EB",
  lozf: "\u29EB",
  bigcirc: "\u25EF",
  xcirc: "\u25EF",
  circ: "\u02C6",
  Circle: "\u25CB",
  cir: "\u25CB",
  o: "\u25CB",
  bullet: "\u2022",
  bull: "\u2022",
  hellip: "\u2026",
  mldr: "\u2026",
  nldr: "\u2025",
  boxh: "\u2500",
  HorizontalLine: "\u2500",
  boxv: "\u2502",
  boxdr: "\u250C",
  boxdl: "\u2510",
  boxur: "\u2514",
  boxul: "\u2518",
  boxvr: "\u251C",
  boxvl: "\u2524",
  boxhd: "\u252C",
  boxhu: "\u2534",
  boxvh: "\u253C",
  boxH: "\u2550",
  boxV: "\u2551",
  boxdR: "\u2552",
  boxDr: "\u2553",
  boxDR: "\u2554",
  boxDl: "\u2555",
  boxdL: "\u2556",
  boxDL: "\u2557",
  boxuR: "\u2558",
  boxUr: "\u2559",
  boxUR: "\u255A",
  boxUl: "\u255C",
  boxuL: "\u255B",
  boxUL: "\u255D",
  boxvR: "\u255E",
  boxVr: "\u255F",
  boxVR: "\u2560",
  boxVl: "\u2562",
  boxvL: "\u2561",
  boxVL: "\u2563",
  boxHd: "\u2564",
  boxhD: "\u2565",
  boxHD: "\u2566",
  boxHu: "\u2567",
  boxhU: "\u2568",
  boxHU: "\u2569",
  boxvH: "\u256A",
  boxVh: "\u256B",
  boxVH: "\u256C"
};
var PUNCTUATION = {
  excl: "!",
  iexcl: "\xA1",
  brvbar: "\xA6",
  sect: "\xA7",
  uml: "\xA8",
  copy: "\xA9",
  ordf: "\xAA",
  laquo: "\xAB",
  not: "\xAC",
  shy: "\xAD",
  reg: "\xAE",
  macr: "\xAF",
  deg: "\xB0",
  plusmn: "\xB1",
  sup2: "\xB2",
  sup3: "\xB3",
  acute: "\xB4",
  micro: "\xB5",
  para: "\xB6",
  middot: "\xB7",
  cedil: "\xB8",
  sup1: "\xB9",
  ordm: "\xBA",
  raquo: "\xBB",
  frac14: "\xBC",
  frac12: "\xBD",
  frac34: "\xBE",
  iquest: "\xBF",
  nbsp: "\xA0",
  comma: ",",
  period: ".",
  colon: ":",
  semi: ";",
  vert: "|",
  Verbar: "\u2016",
  verbar: "|",
  dblac: "\u02DD",
  circ: "\u02C6",
  caron: "\u02C7",
  breve: "\u02D8",
  dot: "\u02D9",
  ring: "\u02DA",
  ogon: "\u02DB",
  tilde: "\u02DC",
  DiacriticalGrave: "`",
  DiacriticalAcute: "\xB4",
  DiacriticalTilde: "\u02DC",
  DiacriticalDot: "\u02D9",
  DiacriticalDoubleAcute: "\u02DD",
  grave: "`"
};
var CURRENCY = {
  cent: "\xA2",
  pound: "\xA3",
  curren: "\xA4",
  yen: "\xA5",
  euro: "\u20AC",
  dollar: "$",
  fnof: "\u0192",
  inr: "\u20B9",
  af: "\u060B",
  birr: "\u1265\u122D",
  peso: "\u20B1",
  rub: "\u20BD",
  won: "\u20A9",
  yuan: "\xA5",
  cedil: "\xB8"
};
var FRACTIONS = {
  frac12: "\xBD",
  half: "\xBD",
  frac13: "\u2153",
  frac14: "\xBC",
  frac15: "\u2155",
  frac16: "\u2159",
  frac18: "\u215B",
  frac23: "\u2154",
  frac25: "\u2156",
  frac34: "\xBE",
  frac35: "\u2157",
  frac38: "\u215C",
  frac45: "\u2158",
  frac56: "\u215A",
  frac58: "\u215D",
  frac78: "\u215E",
  frasl: "\u2044"
};
var MISC_SYMBOLS = {
  trade: "\u2122",
  TRADE: "\u2122",
  telrec: "\u2315",
  target: "\u2316",
  ulcorn: "\u231C",
  ulcorner: "\u231C",
  urcorn: "\u231D",
  urcorner: "\u231D",
  dlcorn: "\u231E",
  llcorner: "\u231E",
  drcorn: "\u231F",
  lrcorner: "\u231F",
  intercal: "\u22BA",
  intcal: "\u22BA",
  oplus: "\u2295",
  CirclePlus: "\u2295",
  ominus: "\u2296",
  CircleMinus: "\u2296",
  otimes: "\u2297",
  CircleTimes: "\u2297",
  osol: "\u2298",
  odot: "\u2299",
  CircleDot: "\u2299",
  oast: "\u229B",
  circledast: "\u229B",
  odash: "\u229D",
  circleddash: "\u229D",
  ocirc: "\u229A",
  circledcirc: "\u229A",
  boxplus: "\u229E",
  plusb: "\u229E",
  boxminus: "\u229F",
  minusb: "\u229F",
  boxtimes: "\u22A0",
  timesb: "\u22A0",
  boxdot: "\u22A1",
  sdotb: "\u22A1",
  veebar: "\u22BB",
  vee: "\u2228",
  barvee: "\u22BD",
  and: "\u2227",
  wedge: "\u2227",
  Cap: "\u22D2",
  Cup: "\u22D3",
  Fork: "\u22D4",
  pitchfork: "\u22D4",
  epar: "\u22D5",
  ltlarr: "\u2976",
  nvap: "\u224D\u20D2",
  nvsim: "\u223C\u20D2",
  nvge: "\u2265\u20D2",
  nvle: "\u2264\u20D2",
  nvlt: "<\u20D2",
  nvgt: ">\u20D2",
  nvltrie: "\u22B4\u20D2",
  nvrtrie: "\u22B5\u20D2",
  Vdash: "\u22A9",
  dashv: "\u22A3",
  vDash: "\u22A8",
  Vvdash: "\u22AA",
  nvdash: "\u22AC",
  nvDash: "\u22AD",
  nVdash: "\u22AE",
  nVDash: "\u22AF"
};
var ALL_ENTITIES = {
  ...BASIC_LATIN,
  ...LATIN_ACCENTS,
  ...LATIN_EXTENDED,
  ...GREEK,
  ...CYRILLIC,
  ...MATH,
  ...MATH_ADVANCED,
  ...ARROWS,
  ...SHAPES,
  ...PUNCTUATION,
  ...CURRENCY,
  ...FRACTIONS,
  ...MISC_SYMBOLS
};
var XML = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"'
};
var COMMON_HTML = {
  nbsp: "\xA0",
  copy: "\xA9",
  reg: "\xAE",
  trade: "\u2122",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  laquo: "\xAB",
  raquo: "\xBB",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  bull: "\u2022",
  para: "\xB6",
  sect: "\xA7",
  deg: "\xB0",
  frac12: "\xBD",
  frac14: "\xBC",
  frac34: "\xBE"
};

// ../verify/node_modules/@nodable/entities/src/EntityDecoder.js
var ENTITY_ACTION = Object.freeze({
  /** Resolve and expand the entity normally. */
  ALLOW: "allow",
  /** Silently skip this entity — it will not be registered. */
  BLOCK: "block",
  /** Throw an error, aborting entity registration entirely. */
  THROW: "throw"
});
var SPECIAL_CHARS = new Set("!?\\\\/[]$%{}^&*()<>|+");
function validateEntityName(name) {
  if (name[0] === "#") {
    throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${name}"`);
  }
  for (const ch of name) {
    if (SPECIAL_CHARS.has(ch)) {
      throw new Error(`[EntityReplacer] Invalid character '${ch}' in entity name: "${name}"`);
    }
  }
  return name;
}
function mergeEntityMaps(...maps) {
  const out = /* @__PURE__ */ Object.create(null);
  for (const map of maps) {
    if (!map) continue;
    for (const key of Object.keys(map)) {
      const raw = map[key];
      if (typeof raw === "string") {
        out[key] = raw;
      } else if (raw && typeof raw === "object" && raw.val !== void 0) {
        const val = raw.val;
        if (typeof val === "string") {
          out[key] = val;
        }
      }
    }
  }
  return out;
}
var LIMIT_TIER_EXTERNAL = "external";
var LIMIT_TIER_BASE = "base";
var LIMIT_TIER_ALL = "all";
function parseLimitTiers(raw) {
  if (!raw || raw === LIMIT_TIER_EXTERNAL) return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
  if (raw === LIMIT_TIER_ALL) return /* @__PURE__ */ new Set([LIMIT_TIER_ALL]);
  if (raw === LIMIT_TIER_BASE) return /* @__PURE__ */ new Set([LIMIT_TIER_BASE]);
  if (Array.isArray(raw)) return new Set(raw);
  return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
}
var NCR_LEVEL = Object.freeze({ allow: 0, leave: 1, remove: 2, throw: 3 });
var XML10_ALLOWED_C0 = /* @__PURE__ */ new Set([9, 10, 13]);
function parseNCRConfig(ncr) {
  if (!ncr) {
    return { xmlVersion: 1, onLevel: NCR_LEVEL.allow, nullLevel: NCR_LEVEL.remove };
  }
  const xmlVersion = ncr.xmlVersion === 1.1 ? 1.1 : 1;
  const onLevel = NCR_LEVEL[ncr.onNCR] ?? NCR_LEVEL.allow;
  const nullLevel = NCR_LEVEL[ncr.nullNCR] ?? NCR_LEVEL.remove;
  const clampedNull = Math.max(nullLevel, NCR_LEVEL.remove);
  return { xmlVersion, onLevel, nullLevel: clampedNull };
}
var EntityDecoder = class {
  /**
   * @param {object} [options]
   * @param {object|null}  [options.namedEntities]        — extra named entities merged into base map
   * @param {object}  [options.limit]                 — security limits
   * @param {number}       [options.limit.maxTotalExpansions=0]  — 0 = unlimited
   * @param {number}       [options.limit.maxExpandedLength=0]   — 0 = unlimited
   * @param {'external'|'base'|'all'|string[]} [options.limit.applyLimitsTo='external']
   *   Which entity tiers count against the security limits:
   *   - 'external' (default) — only input/runtime + persistent external entities
   *   - 'base'               — only DEFAULT_XML_ENTITIES + namedEntities
   *   - 'all'                — every entity regardless of tier
   *   - string[]             — explicit combination, e.g. ['external', 'base']
   * @param {((resolved: string, original: string) => string)|null} [options.postCheck=null]
   * @param {string[]} [options.remove=[]] — entity names (e.g. ['nbsp', '#13']) to delete (replace with empty string)
   * @param {string[]} [options.leave=[]]  — entity names to keep as literal (unchanged in output)
   * @param {object}   [options.ncr]       — Numeric Character Reference controls
   * @param {1.0|1.1}  [options.ncr.xmlVersion=1.0]
   *   XML version governing which codepoint ranges are restricted:
   *   - 1.0 — C0 controls U+0001–U+001F (except U+0009/000A/000D) are prohibited
   *   - 1.1 — C0 controls are allowed when written as NCRs; C1 (U+007F–U+009F) decoded as-is
   * @param {'allow'|'leave'|'remove'|'throw'} [options.ncr.onNCR='allow']
   *   Base action for numeric references. Severity order: allow < leave < remove < throw.
   *   For codepoint ranges that carry a minimum level (surrogates → remove, XML 1.0 C0 → remove),
   *   the effective action is max(onNCR, rangeMinimum).
   * @param {'remove'|'throw'} [options.ncr.nullNCR='remove']
   *   Action for U+0000 (null). 'allow' and 'leave' are clamped to 'remove' since null is never safe.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onExternalEntity=null]
   *   Hook called when an external entity is registered via `setExternalEntities()` or
   *   `addExternalEntity()`. Return `ENTITY_ACTION.ALLOW` to accept the entity,
   *   `ENTITY_ACTION.BLOCK` to silently skip it, or `ENTITY_ACTION.THROW` to abort with an error.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onInputEntity=null]
   *   Hook called when an input entity is registered via `addInputEntities()`. Return
   *   `ENTITY_ACTION.ALLOW` to accept, `ENTITY_ACTION.BLOCK` to silently skip, or
   *   `ENTITY_ACTION.THROW` to abort with an error.
   */
  constructor(options = {}) {
    this._limit = options.limit || {};
    this._maxTotalExpansions = this._limit.maxTotalExpansions || 0;
    this._maxExpandedLength = this._limit.maxExpandedLength || 0;
    this._postCheck = typeof options.postCheck === "function" ? options.postCheck : (r) => r;
    this._limitTiers = parseLimitTiers(this._limit.applyLimitsTo ?? LIMIT_TIER_EXTERNAL);
    this._numericAllowed = options.numericAllowed ?? true;
    this._baseMap = mergeEntityMaps(XML, options.namedEntities || null);
    this._externalMap = /* @__PURE__ */ Object.create(null);
    this._inputMap = /* @__PURE__ */ Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    this._removeSet = new Set(options.remove && Array.isArray(options.remove) ? options.remove : []);
    this._leaveSet = new Set(options.leave && Array.isArray(options.leave) ? options.leave : []);
    const ncrCfg = parseNCRConfig(options.ncr);
    this._ncrXmlVersion = ncrCfg.xmlVersion;
    this._ncrOnLevel = ncrCfg.onLevel;
    this._ncrNullLevel = ncrCfg.nullLevel;
    this._onExternalEntity = typeof options.onExternalEntity === "function" ? options.onExternalEntity : null;
    this._onInputEntity = typeof options.onInputEntity === "function" ? options.onInputEntity : null;
  }
  // -------------------------------------------------------------------------
  // Private: registration hook dispatch
  // -------------------------------------------------------------------------
  /**
   * Invoke a registration hook for a single entity name/value pair.
   * Returns true when the entity should be accepted, false when it should be
   * silently skipped (BLOCK), and throws when the hook returns THROW.
   *
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} hook
   * @param {string} name
   * @param {string} value
   * @param {string} context  — used in error messages ('external' | 'input')
   * @returns {boolean}  true = accept, false = skip
   */
  _applyRegistrationHook(hook, name, value, context) {
    if (!hook) return true;
    const action = hook(name, value);
    if (action === ENTITY_ACTION.BLOCK) return false;
    if (action === ENTITY_ACTION.THROW) {
      throw new Error(
        `[EntityDecoder] Registration of ${context} entity "&${name};" was rejected by hook`
      );
    }
    return true;
  }
  // -------------------------------------------------------------------------
  // Persistent external entity registration
  // -------------------------------------------------------------------------
  /**
   * Replace the full set of persistent external entities.
   * All keys are validated — throws on invalid characters.
   * If `onExternalEntity` is set, it is called once per entry; entries that
   * return `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW`
   * aborts the whole call.
   * @param {Record<string, string | { regex?: RegExp, val: string }>} map
   */
  setExternalEntities(map) {
    if (map) {
      for (const key of Object.keys(map)) {
        validateEntityName(key);
      }
    }
    if (!this._onExternalEntity) {
      this._externalMap = mergeEntityMaps(map);
      return;
    }
    const flat = mergeEntityMaps(map);
    const filtered = /* @__PURE__ */ Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onExternalEntity, name, value, "external")) {
        filtered[name] = value;
      }
    }
    this._externalMap = filtered;
  }
  /**
   * Add a single persistent external entity.
   * If `onExternalEntity` is set it is called before the entity is stored;
   * `ENTITY_ACTION.BLOCK` silently skips storage, `ENTITY_ACTION.THROW` raises.
   * @param {string} key
   * @param {string} value
   */
  addExternalEntity(key, value) {
    validateEntityName(key);
    if (typeof value === "string" && value.indexOf("&") === -1) {
      if (this._applyRegistrationHook(this._onExternalEntity, key, value, "external")) {
        this._externalMap[key] = value;
      }
    }
  }
  // -------------------------------------------------------------------------
  // Input / runtime entity registration (per document)
  // -------------------------------------------------------------------------
  /**
   * Inject DOCTYPE entities for the current document.
   * Also resets per-document expansion counters.
   * If `onInputEntity` is set it is called once per entry; entries returning
   * `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW` aborts.
   * @param {Record<string, string | { regx?: RegExp, regex?: RegExp, val: string }>} map
   */
  addInputEntities(map) {
    this._totalExpansions = 0;
    this._expandedLength = 0;
    if (!this._onInputEntity) {
      this._inputMap = mergeEntityMaps(map);
      return;
    }
    const flat = mergeEntityMaps(map);
    const filtered = /* @__PURE__ */ Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onInputEntity, name, value, "input")) {
        filtered[name] = value;
      }
    }
    this._inputMap = filtered;
  }
  // -------------------------------------------------------------------------
  // Per-document reset
  // -------------------------------------------------------------------------
  /**
   * Wipe input/runtime entities and reset counters.
   * Call this before processing each new document.
   * @returns {this}
   */
  reset() {
    this._inputMap = /* @__PURE__ */ Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    return this;
  }
  // -------------------------------------------------------------------------
  // XML version (can be set after construction, e.g. once parser reads <?xml?>)
  // -------------------------------------------------------------------------
  /**
   * Update the XML version used for NCR classification.
   * Call this as soon as the document's `<?xml version="...">` declaration is parsed.
   * @param {1.0|1.1|number} version
   */
  setXmlVersion(version) {
    this._ncrXmlVersion = version === 1.1 ? 1.1 : 1;
  }
  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------
  /**
   * Replace all entity references in `str` in a single pass.
   *
   * @param {string} str
   * @returns {string}
   */
  decode(str) {
    if (typeof str !== "string" || str.length === 0) return str;
    if (str.indexOf("&") === -1) return str;
    const original = str;
    const chunks = [];
    const len = str.length;
    let last = 0;
    let i = 0;
    const limitExpansions = this._maxTotalExpansions > 0;
    const limitLength = this._maxExpandedLength > 0;
    const checkLimits = limitExpansions || limitLength;
    while (i < len) {
      if (str.charCodeAt(i) !== 38) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < len && str.charCodeAt(j) !== 59 && j - i <= 32) j++;
      if (j >= len || str.charCodeAt(j) !== 59) {
        i++;
        continue;
      }
      const token = str.slice(i + 1, j);
      if (token.length === 0) {
        i++;
        continue;
      }
      let replacement;
      let tier;
      if (this._removeSet.has(token)) {
        replacement = "";
        if (tier === void 0) {
          tier = LIMIT_TIER_EXTERNAL;
        }
      } else if (this._leaveSet.has(token)) {
        i++;
        continue;
      } else if (token.charCodeAt(0) === 35) {
        const ncrResult = this._resolveNCR(token);
        if (ncrResult === void 0) {
          i++;
          continue;
        }
        replacement = ncrResult;
        tier = LIMIT_TIER_BASE;
      } else {
        const resolved = this._resolveName(token);
        replacement = resolved?.value;
        tier = resolved?.tier;
      }
      if (replacement === void 0) {
        i++;
        continue;
      }
      if (i > last) chunks.push(str.slice(last, i));
      chunks.push(replacement);
      last = j + 1;
      i = last;
      if (checkLimits && this._tierCounts(tier)) {
        if (limitExpansions) {
          this._totalExpansions++;
          if (this._totalExpansions > this._maxTotalExpansions) {
            throw new Error(
              `[EntityReplacer] Entity expansion count limit exceeded: ${this._totalExpansions} > ${this._maxTotalExpansions}`
            );
          }
        }
        if (limitLength) {
          const delta = replacement.length - (token.length + 2);
          if (delta > 0) {
            this._expandedLength += delta;
            if (this._expandedLength > this._maxExpandedLength) {
              throw new Error(
                `[EntityReplacer] Expanded content length limit exceeded: ${this._expandedLength} > ${this._maxExpandedLength}`
              );
            }
          }
        }
      }
    }
    if (last < len) chunks.push(str.slice(last));
    const result = chunks.length === 0 ? str : chunks.join("");
    return this._postCheck(result, original);
  }
  // -------------------------------------------------------------------------
  // Private: limit tier check
  // -------------------------------------------------------------------------
  /**
   * Returns true if a resolved entity of the given tier should count
   * against the expansion/length limits.
   * @param {string} tier  — LIMIT_TIER_EXTERNAL | LIMIT_TIER_BASE
   * @returns {boolean}
   */
  _tierCounts(tier) {
    if (this._limitTiers.has(LIMIT_TIER_ALL)) return true;
    return this._limitTiers.has(tier);
  }
  // -------------------------------------------------------------------------
  // Private: entity resolution
  // -------------------------------------------------------------------------
  /**
   * Resolve a named entity token (without & and ;).
   * Priority: inputMap > externalMap > baseMap
   * Returns the resolved value tagged with its limit tier.
   *
   * @param {string} name
   * @returns {{ value: string, tier: string }|undefined}
   */
  _resolveName(name) {
    if (name in this._inputMap) return { value: this._inputMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._externalMap) return { value: this._externalMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._baseMap) return { value: this._baseMap[name], tier: LIMIT_TIER_BASE };
    return void 0;
  }
  /**
   * Classify a codepoint and return the minimum action level that must be applied.
   * Returns -1 when no minimum is imposed (normal allow path).
   *
   * Ranges checked (in priority order):
   *   1. U+0000            — null, governed by nullNCR (always ≥ remove)
   *   2. U+D800–U+DFFF     — surrogates, always prohibited (min: remove)
   *   3. U+0001–U+001F \ {0x09,0x0A,0x0D}  — XML 1.0 restricted C0 (min: remove)
   *      (skipped in XML 1.1 — C0 controls are allowed when written as NCRs)
   *
   * @param {number} cp  — codepoint
   * @returns {number}   — minimum NCR_LEVEL value, or -1 for no restriction
   */
  _classifyNCR(cp) {
    if (cp === 0) return this._ncrNullLevel;
    if (cp >= 55296 && cp <= 57343) return NCR_LEVEL.remove;
    if (this._ncrXmlVersion === 1) {
      if (cp >= 1 && cp <= 31 && !XML10_ALLOWED_C0.has(cp)) return NCR_LEVEL.remove;
    }
    return -1;
  }
  /**
   * Execute a resolved NCR action.
   *
   * @param {number} action   — NCR_LEVEL value
   * @param {string} token    — raw token (e.g. '#38') for error messages
   * @param {number} cp       — codepoint, used only for error messages
   * @returns {string|undefined}
   *   - decoded character string  → 'allow'
   *   - ''                        → 'remove'
   *   - undefined                 → 'leave' (caller must skip past '&' only)
   *   - throws Error              → 'throw'
   */
  _applyNCRAction(action, token, cp) {
    switch (action) {
      case NCR_LEVEL.allow:
        return String.fromCodePoint(cp);
      case NCR_LEVEL.remove:
        return "";
      case NCR_LEVEL.leave:
        return void 0;
      // signal: keep literal
      case NCR_LEVEL.throw:
        throw new Error(
          `[EntityDecoder] Prohibited numeric character reference &${token}; (U+${cp.toString(16).toUpperCase().padStart(4, "0")})`
        );
      default:
        return String.fromCodePoint(cp);
    }
  }
  /**
   * Full NCR resolution pipeline for a numeric token.
   *
   * Steps:
   *   1. Parse the codepoint (decimal or hex).
   *   2. Validate the raw codepoint range (NaN, <0, >0x10FFFF).
   *   3. If numericAllowed is false and no minimum restriction applies → leave as-is.
   *   4. Classify the codepoint to find the minimum required action level.
   *   5. Resolve effective action = max(onNCR, minimum).
   *   6. Apply and return.
   *
   * @param {string} token  — e.g. '#38', '#x26', '#X26'
   * @returns {string|undefined}
   *   - string (incl. '')  — replacement ('' = remove)
   *   - undefined          — leave original &token; as-is
   */
  _resolveNCR(token) {
    const second = token.charCodeAt(1);
    let cp;
    if (second === 120 || second === 88) {
      cp = parseInt(token.slice(2), 16);
    } else {
      cp = parseInt(token.slice(1), 10);
    }
    if (Number.isNaN(cp) || cp < 0 || cp > 1114111) return void 0;
    const minimum = this._classifyNCR(cp);
    if (!this._numericAllowed && minimum < NCR_LEVEL.remove) return void 0;
    const effective = minimum === -1 ? this._ncrOnLevel : Math.max(this._ncrOnLevel, minimum);
    return this._applyNCRAction(effective, token, cp);
  }
};

// ../verify/node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var defaultOnDangerousProperty = (name) => {
  if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
    return "__" + name;
  }
  return name;
};
var defaultOptions2 = {
  preserveOrder: false,
  attributeNamePrefix: "@_",
  attributesGroupName: false,
  textNodeName: "#text",
  ignoreAttributes: true,
  removeNSPrefix: false,
  // remove NS from tag name or attribute name if true
  allowBooleanAttributes: false,
  //a tag can have attributes without any value
  //ignoreRootElement : false,
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true,
  //Trim string values of tag and attributes
  cdataPropName: false,
  numberParseOptions: {
    hex: true,
    leadingZeros: true,
    eNotation: true
  },
  tagValueProcessor: function(tagName, val) {
    return val;
  },
  attributeValueProcessor: function(attrName, val) {
    return val;
  },
  stopNodes: [],
  //nested tags will not be parsed even for errors
  alwaysCreateTextNode: false,
  isArray: () => false,
  commentPropName: false,
  unpairedTags: [],
  processEntities: true,
  htmlEntities: false,
  entityDecoder: null,
  ignoreDeclaration: false,
  ignorePiTags: false,
  transformTagName: false,
  transformAttributeName: false,
  updateTag: function(tagName, jPath, attrs) {
    return tagName;
  },
  // skipEmptyListItem: false
  captureMetaData: false,
  maxNestedTags: 100,
  strictReservedNames: true,
  jPath: true,
  // if true, pass jPath string to callbacks; if false, pass matcher instance
  onDangerousProperty: defaultOnDangerousProperty
};
function validatePropertyName(propertyName, optionName) {
  if (typeof propertyName !== "string") {
    return;
  }
  const normalized2 = propertyName.toLowerCase();
  if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized2 === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }
  if (criticalProperties.some((dangerous) => normalized2 === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }
}
function normalizeProcessEntities(value, htmlEntities) {
  if (typeof value === "boolean") {
    return {
      enabled: value,
      // true or false
      maxEntitySize: 1e4,
      maxExpansionDepth: 1e4,
      maxTotalExpansions: Infinity,
      maxExpandedLength: 1e5,
      maxEntityCount: 1e3,
      allowedTags: null,
      tagFilter: null,
      appliesTo: "all"
    };
  }
  if (typeof value === "object" && value !== null) {
    return {
      enabled: value.enabled !== false,
      maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
      maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
      maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
      maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
      maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
      allowedTags: value.allowedTags ?? null,
      tagFilter: value.tagFilter ?? null,
      appliesTo: value.appliesTo ?? "all"
    };
  }
  return normalizeProcessEntities(true);
}
var buildOptions = function(options) {
  const built = Object.assign({}, defaultOptions2, options);
  const propertyNameOptions = [
    { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
    { value: built.attributesGroupName, name: "attributesGroupName" },
    { value: built.textNodeName, name: "textNodeName" },
    { value: built.cdataPropName, name: "cdataPropName" },
    { value: built.commentPropName, name: "commentPropName" }
  ];
  for (const { value, name } of propertyNameOptions) {
    if (value) {
      validatePropertyName(value, name);
    }
  }
  if (built.onDangerousProperty === null) {
    built.onDangerousProperty = defaultOnDangerousProperty;
  }
  built.processEntities = normalizeProcessEntities(built.processEntities, built.htmlEntities);
  built.unpairedTagsSet = new Set(built.unpairedTags);
  if (built.stopNodes && Array.isArray(built.stopNodes)) {
    built.stopNodes = built.stopNodes.map((node) => {
      if (typeof node === "string" && node.startsWith("*.")) {
        return ".." + node.substring(2);
      }
      return node;
    });
  }
  return built;
};

// ../verify/node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var METADATA_SYMBOL;
if (typeof Symbol !== "function") {
  METADATA_SYMBOL = "@@xmlMetadata";
} else {
  METADATA_SYMBOL = /* @__PURE__ */ Symbol("XML Node Metadata");
}
var XmlNode = class {
  constructor(tagname) {
    this.tagname = tagname;
    this.child = [];
    this[":@"] = /* @__PURE__ */ Object.create(null);
  }
  add(key, val) {
    if (key === "__proto__") key = "#__proto__";
    this.child.push({ [key]: val });
  }
  addChild(node, startIndex) {
    if (node.tagname === "__proto__") node.tagname = "#__proto__";
    if (node[":@"] && Object.keys(node[":@"]).length > 0) {
      this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
    } else {
      this.child.push({ [node.tagname]: node.child });
    }
    if (startIndex !== void 0) {
      this.child[this.child.length - 1][METADATA_SYMBOL] = { startIndex };
    }
  }
  /** symbol used for metadata */
  static getMetaDataSymbol() {
    return METADATA_SYMBOL;
  }
};

// ../verify/node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var DocTypeReader = class {
  constructor(options) {
    this.suppressValidationErr = !options;
    this.options = options;
  }
  readDocType(xmlData, i) {
    const entities = /* @__PURE__ */ Object.create(null);
    let entityCount = 0;
    if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
      i = i + 9;
      let angleBracketsCount = 1;
      let hasBody = false, comment = false;
      let exp = "";
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === "<" && !comment) {
          if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
            i += 7;
            let entityName, val;
            [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
            if (val.indexOf("&") === -1) {
              if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                throw new Error(
                  `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                );
              }
              entities[entityName] = val;
              entityCount++;
            }
          } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
            i += 8;
            const { index } = this.readElementExp(xmlData, i + 1);
            i = index;
          } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
            i += 8;
          } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
            i += 9;
            const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
            i = index;
          } else if (hasSeq(xmlData, "!--", i)) comment = true;
          else throw new Error(`Invalid DOCTYPE`);
          angleBracketsCount++;
          exp = "";
        } else if (xmlData[i] === ">") {
          if (comment) {
            if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
              comment = false;
              angleBracketsCount--;
            }
          } else {
            angleBracketsCount--;
          }
          if (angleBracketsCount === 0) {
            break;
          }
        } else if (xmlData[i] === "[") {
          hasBody = true;
        } else {
          exp += xmlData[i];
        }
      }
      if (angleBracketsCount !== 0) {
        throw new Error(`Unclosed DOCTYPE`);
      }
    } else {
      throw new Error(`Invalid Tag instead of DOCTYPE`);
    }
    return { entities, i };
  }
  readEntityExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    const startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
      i++;
    }
    let entityName = xmlData.substring(startIndex, i);
    validateEntityName2(entityName);
    i = skipWhitespace(xmlData, i);
    if (!this.suppressValidationErr) {
      if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
        throw new Error("External entities are not supported");
      } else if (xmlData[i] === "%") {
        throw new Error("Parameter entities are not supported");
      }
    }
    let entityValue = "";
    [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");
    if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
      throw new Error(
        `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
      );
    }
    i--;
    return [entityName, entityValue, i];
  }
  readNotationExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    const startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let notationName = xmlData.substring(startIndex, i);
    !this.suppressValidationErr && validateEntityName2(notationName);
    i = skipWhitespace(xmlData, i);
    const identifierType = xmlData.substring(i, i + 6).toUpperCase();
    if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
      throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
    }
    i += identifierType.length;
    i = skipWhitespace(xmlData, i);
    let publicIdentifier = null;
    let systemIdentifier = null;
    if (identifierType === "PUBLIC") {
      [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");
      i = skipWhitespace(xmlData, i);
      if (xmlData[i] === '"' || xmlData[i] === "'") {
        [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
      }
    } else if (identifierType === "SYSTEM") {
      [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
      if (!this.suppressValidationErr && !systemIdentifier) {
        throw new Error("Missing mandatory system identifier for SYSTEM notation");
      }
    }
    return { notationName, publicIdentifier, systemIdentifier, index: --i };
  }
  readIdentifierVal(xmlData, i, type) {
    let identifierVal = "";
    const startChar = xmlData[i];
    if (startChar !== '"' && startChar !== "'") {
      throw new Error(`Expected quoted string, found "${startChar}"`);
    }
    i++;
    const startIndex = i;
    while (i < xmlData.length && xmlData[i] !== startChar) {
      i++;
    }
    identifierVal = xmlData.substring(startIndex, i);
    if (xmlData[i] !== startChar) {
      throw new Error(`Unterminated ${type} value`);
    }
    i++;
    return [i, identifierVal];
  }
  readElementExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    const startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let elementName = xmlData.substring(startIndex, i);
    if (!this.suppressValidationErr && !isName(elementName)) {
      throw new Error(`Invalid element name: "${elementName}"`);
    }
    i = skipWhitespace(xmlData, i);
    let contentModel = "";
    if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) i += 4;
    else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) i += 2;
    else if (xmlData[i] === "(") {
      i++;
      const startIndex2 = i;
      while (i < xmlData.length && xmlData[i] !== ")") {
        i++;
      }
      contentModel = xmlData.substring(startIndex2, i);
      if (xmlData[i] !== ")") {
        throw new Error("Unterminated content model");
      }
    } else if (!this.suppressValidationErr) {
      throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
    }
    return {
      elementName,
      contentModel: contentModel.trim(),
      index: i
    };
  }
  readAttlistExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    let startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let elementName = xmlData.substring(startIndex, i);
    validateEntityName2(elementName);
    i = skipWhitespace(xmlData, i);
    startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let attributeName = xmlData.substring(startIndex, i);
    if (!validateEntityName2(attributeName)) {
      throw new Error(`Invalid attribute name: "${attributeName}"`);
    }
    i = skipWhitespace(xmlData, i);
    let attributeType = "";
    if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
      attributeType = "NOTATION";
      i += 8;
      i = skipWhitespace(xmlData, i);
      if (xmlData[i] !== "(") {
        throw new Error(`Expected '(', found "${xmlData[i]}"`);
      }
      i++;
      let allowedNotations = [];
      while (i < xmlData.length && xmlData[i] !== ")") {
        const startIndex2 = i;
        while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
          i++;
        }
        let notation = xmlData.substring(startIndex2, i);
        notation = notation.trim();
        if (!validateEntityName2(notation)) {
          throw new Error(`Invalid notation name: "${notation}"`);
        }
        allowedNotations.push(notation);
        if (xmlData[i] === "|") {
          i++;
          i = skipWhitespace(xmlData, i);
        }
      }
      if (xmlData[i] !== ")") {
        throw new Error("Unterminated list of notations");
      }
      i++;
      attributeType += " (" + allowedNotations.join("|") + ")";
    } else {
      const startIndex2 = i;
      while (i < xmlData.length && !/\s/.test(xmlData[i])) {
        i++;
      }
      attributeType += xmlData.substring(startIndex2, i);
      const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
      if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
        throw new Error(`Invalid attribute type: "${attributeType}"`);
      }
    }
    i = skipWhitespace(xmlData, i);
    let defaultValue = "";
    if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
      defaultValue = "#REQUIRED";
      i += 8;
    } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
      defaultValue = "#IMPLIED";
      i += 7;
    } else {
      [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
    }
    return {
      elementName,
      attributeName,
      attributeType,
      defaultValue,
      index: i
    };
  }
};
var skipWhitespace = (data, index) => {
  while (index < data.length && /\s/.test(data[index])) {
    index++;
  }
  return index;
};
function hasSeq(data, seq, i) {
  for (let j = 0; j < seq.length; j++) {
    if (seq[j] !== data[i + j + 1]) return false;
  }
  return true;
}
function validateEntityName2(name) {
  if (isName(name))
    return name;
  else
    throw new Error(`Invalid entity name ${name}`);
}

// ../verify/node_modules/anynum/digitTable.js
var SCRIPT_ZEROS = [
  // Basic Latin (ASCII) — included for completeness / pass-through
  48,
  // 0-9
  // Arabic scripts
  1632,
  // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
  1776,
  // Extended Arabic-Indic (Urdu/Persian/Sindhi) ۰۱۲۳
  // Indic scripts
  2406,
  // Devanagari ०१२३४५६७८९
  2534,
  // Bengali ০১২৩৪৫৬৭৮৯
  2662,
  // Gurmukhi ੦੧੨੩੪੫੬੭੮੯
  2790,
  // Gujarati ૦૧૨૩૪૫૬૭૮૯
  2918,
  // Odia ୦୧୨୩୪୫୬୭୮୯
  3046,
  // Tamil ௦௧௨௩௪௫௬௭௮௯
  3174,
  // Telugu ౦౧౨౩౪౫౬౭౮౯
  3302,
  // Kannada ೦೧೨೩೪೫೬೭೮೯
  3430,
  // Malayalam ൦൧൨൩൪൫൬൭൮൯
  3558,
  // Sinhala Archaic ෦෧෨෩෪෫෬෭෮෯
  // Southeast Asian scripts
  3664,
  // Thai ๐๑๒๓๔๕๖๗๘๙
  3792,
  // Lao ໐໑໒໓໔໕໖໗໘໙
  3872,
  // Tibetan ༠༡༢༣༤༥༦༧༨༩
  4160,
  // Myanmar ၀၁၂၃၄၅၆၇၈၉
  4240,
  // Myanmar Shan ႐႑႒႓႔႕႖႗႘႙
  6112,
  // Khmer ០១២៣៤៥៦៧៨៩
  6160,
  // Mongolian ᠐᠑᠒᠓᠔᠕᠖᠗᠘᠙
  6470,
  // Limbu ᥆᥇᥈᥉᥊᥋᥌᥍᥎᥏
  6608,
  // New Tai Lue ᧐᧑᧒᧓᧔᧕᧖᧗᧘᧙
  6784,
  // Tai Tham Hora ᪀᪁᪂᪃᪄᪅᪆᪇᪈᪉
  6800,
  // Tai Tham Tham ᪐᪑᪒᪓᪔᪕᪖᪗᪘᪙
  6992,
  // Balinese ᭐᭑᭒᭓᭔᭕᭖᭗᭘᭙
  7088,
  // Sundanese ᮰᮱᮲᮳᮴᮵᮶᮷᮸᮹
  7232,
  // Lepcha ᱀᱁᱂᱃᱄᱅᱆᱇᱈᱉
  7248,
  // Ol Chiki ᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙
  // Fullwidth (CJK context)
  65296,
  // Fullwidth ０１２３４５６７８９
  // Mathematical digit variants (Unicode math block)
  120782,
  // Mathematical Bold
  120792,
  // Mathematical Double-Struck
  120802,
  // Mathematical Sans-Serif
  120812,
  // Mathematical Sans-Serif Bold
  120822,
  // Mathematical Monospace
  // Other scripts
  66720,
  // Osmanya 𐒠𐒡𐒢𐒣𐒤𐒥𐒦𐒧𐒨𐒩
  68912,
  // Hanifi Rohingya 𐴰𐴱𐴲𐴳𐴴𐴵𐴶𐴷𐴸𐴹
  69734,
  // Brahmi 𑁦𑁧𑁨𑁩𑁪𑁫𑁬𑁭𑁮𑁯
  69872,
  // Sora Sompeng 𑃰𑃱𑃲𑃳𑃴𑃵𑃶𑃷𑃸𑃹
  69942,
  // Chakma 𑄶𑄷𑄸𑄹𑄺𑄻𑄼𑄽𑄾𑄿
  70096,
  // Sharada 𑇐𑇑𑇒𑇓𑇔𑇕𑇖𑇗𑇘𑇙
  70384,
  // Khudawadi 𑋰𑋱𑋲𑋳𑋴𑋵𑋶𑋷𑋸𑋹
  70736,
  // Newa 𑑐𑑑𑑒𑑓𑑔𑑕𑑖𑑗𑑘𑑙
  70864,
  // Tirhuta 𑓐𑓑𑓒𑓓𑓔𑓕𑓖𑓗𑓘𑓙
  71248,
  // Modi 𑙐𑙑𑙒𑙓𑙔𑙕𑙖𑙗𑙘𑙙
  71360,
  // Takri 𑛀𑛁𑛂𑛃𑛄𑛅𑛆𑛇𑛈𑛉
  71472,
  // Ahom 𑜰𑜱𑜲𑜳𑜴𑜵𑜶𑜷𑜸𑜹
  71904,
  // Warang Citi 𑣠𑣡𑣢𑣣𑣤𑣥𑣦𑣧𑣨𑣩
  72016,
  // Dives Akuru 𑥐𑥑𑥒𑥓𑥔𑥕𑥖𑥗𑥘𑥙
  72688,
  // Khitan Small Script 𑯰𑯱𑯲𑯳𑯴𑯵𑯶𑯷𑯸𑯹
  72784,
  // Bhaiksuki 𑱐𑱑𑱒𑱓𑱔𑱕𑱖𑱗𑱘𑱙
  73040,
  // Masaram Gondi 𑵐𑵑𑵒𑵓𑵔𑵕𑵖𑵗𑵘𑵙
  73120,
  // Gunjala Gondi 𑶠𑶡𑶢𑶣𑶤𑶥𑶦𑶧𑶨𑶩
  73552,
  // Kawi 𑽐𑽑𑽒𑽓𑽔𑽕𑽖𑽗𑽘𑽙
  92768,
  // Mro 𖩠𖩡𖩢𖩣𖩤𖩥𖩦𖩧𖩨𖩩
  92864,
  // Tangsa 𖫀𖫁𖫂𖫃𖫄𖫅𖫆𖫇𖫈𖫉
  93008,
  // Pahawh Hmong 𖭐𖭑𖭒𖭓𖭔𖭕𖭖𖭗𖭘𖭙
  123200,
  // Nyiakeng Puachue Hmong 𞅀𞅁𞅂𞅃𞅄𞅅𞅆𞅇𞅈𞅉
  123632,
  // Wancho 𞋰𞋱𞋲𞋳𞋴𞋵𞋶𞋷𞋸𞋹
  124144,
  // Nag Mundari 𞓰𞓱𞓲𞓳𞓴𞓵𞓶𞓷𞓸𞓹
  125264,
  // Adlam 𞥐𞥑𞥒𞥓𞥔𞥕𞥖𞥗𞥘𞥙
  130032
  // Segmented digit symbols 🯰🯱🯲🯳🯴🯵🯶🯷🯸🯹
];
var NOT_DIGIT = 255;
var HIGH_MAP = /* @__PURE__ */ new Map();
var LOW_MAX = 65535;
var LOW_MIN = 1632;
var TABLE_OFFSET = LOW_MIN;
var TABLE_SIZE = LOW_MAX - LOW_MIN + 1;
var TABLE = new Uint8Array(TABLE_SIZE).fill(NOT_DIGIT);
for (const zero of SCRIPT_ZEROS) {
  for (let d = 0; d < 10; d++) {
    const cp = zero + d;
    if (cp <= LOW_MAX) {
      TABLE[cp - TABLE_OFFSET] = d;
    } else {
      HIGH_MAP.set(cp, d);
    }
  }
}

// ../verify/node_modules/anynum/anynum.js
var CHAR_0 = 48;
var CHAR_9 = 57;
var CHAR_MINUS = 45;
var MINUS_SET = /* @__PURE__ */ new Set([8722, 65293, 65123]);
function anynum(str) {
  if (typeof str !== "string") return str;
  const len = str.length;
  if (len === 0) return str;
  let firstHit = -1;
  for (let i = 0; i < len; i++) {
    const cc = str.charCodeAt(i);
    if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) continue;
    if (cc < TABLE_OFFSET) {
      if (MINUS_SET.has(cc)) {
        firstHit = i;
        break;
      }
      continue;
    }
    if (cc >= 55296 && cc <= 56319) {
      if (i + 1 < len) {
        const low = str.charCodeAt(i + 1);
        if (low >= 56320 && low <= 57343) {
          const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
          if (HIGH_MAP.has(cp)) {
            firstHit = i;
            break;
          }
        }
      }
      continue;
    }
    if (TABLE[cc - TABLE_OFFSET] !== NOT_DIGIT || MINUS_SET.has(cc)) {
      firstHit = i;
      break;
    }
  }
  if (firstHit === -1) return str;
  const chars = [];
  if (firstHit > 0) chars.push(str.slice(0, firstHit));
  for (let i = firstHit; i < len; i++) {
    const cc = str.charCodeAt(i);
    if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) {
      chars.push(str[i]);
      continue;
    }
    if (cc < TABLE_OFFSET) {
      chars.push(MINUS_SET.has(cc) ? "-" : str[i]);
      continue;
    }
    if (cc >= 55296 && cc <= 56319) {
      if (i + 1 < len) {
        const low = str.charCodeAt(i + 1);
        if (low >= 56320 && low <= 57343) {
          const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
          const d2 = HIGH_MAP.get(cp);
          if (d2 !== void 0) {
            chars.push(String.fromCharCode(d2 + 48));
            i++;
            continue;
          }
        }
      }
      chars.push(str[i]);
      continue;
    }
    if (MINUS_SET.has(cc)) {
      chars.push("-");
      continue;
    }
    const d = TABLE[cc - TABLE_OFFSET];
    chars.push(d !== NOT_DIGIT ? String.fromCharCode(d + 48) : str[i]);
  }
  return chars.join("");
}
var anynum_default = anynum;

// ../verify/node_modules/strnum/strnum.js
var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
var binRegex = /^0b[01]+$/;
var octRegex = /^0o[0-7]+$/;
var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
var consider = {
  hex: true,
  binary: false,
  octal: false,
  leadingZeros: true,
  decimalPoint: ".",
  eNotation: true,
  //skipLike: /regex/,
  infinity: "original",
  // "null", "infinity" (Infinity type), "string" ("Infinity" (the string literal))
  unicode: false
};
function toNumber(str, options = {}) {
  options = Object.assign({}, consider, options);
  if (!str || typeof str !== "string") return str;
  let trimmedStr = str.trim();
  if (trimmedStr.length === 0) return str;
  else if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
  else if (trimmedStr === "0") return 0;
  if (options.unicode) {
    trimmedStr = anynum_default(trimmedStr);
    if (trimmedStr === "0") return 0;
  }
  if (options.hex && hexRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 16);
  } else if (options.binary && binRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 2);
  } else if (options.octal && octRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 8);
  } else if (!isFinite(trimmedStr)) {
    return handleInfinity(str, Number(trimmedStr), options);
  } else if (trimmedStr.includes("e") || trimmedStr.includes("E")) {
    return resolveEnotation(str, trimmedStr, options);
  } else {
    const match = numRegex.exec(trimmedStr);
    if (match) {
      const sign = match[1] || "";
      const leadingZeros = match[2];
      let numTrimmedByZeros = trimZeros(match[3]);
      const decimalAdjacentToLeadingZeros = sign ? (
        // 0., -00., 000.
        str[leadingZeros.length + 1] === "."
      ) : str[leadingZeros.length] === ".";
      if (!options.leadingZeros && (leadingZeros.length > 1 || leadingZeros.length === 1 && !decimalAdjacentToLeadingZeros)) {
        return str;
      } else {
        const num = Number(trimmedStr);
        const parsedStr = String(num);
        if (num === 0) return num;
        if (parsedStr.search(/[eE]/) !== -1) {
          if (options.eNotation) return num;
          else return str;
        } else if (trimmedStr.indexOf(".") !== -1) {
          if (parsedStr === "0") return num;
          else if (parsedStr === numTrimmedByZeros) return num;
          else if (parsedStr === `${sign}${numTrimmedByZeros}`) return num;
          else return str;
        }
        let n = leadingZeros ? numTrimmedByZeros : trimmedStr;
        if (leadingZeros) {
          return n === parsedStr || sign + n === parsedStr ? num : str;
        } else {
          return n === parsedStr || n === sign + parsedStr ? num : str;
        }
      }
    } else {
      return str;
    }
  }
}
var eNotationRegx = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
function resolveEnotation(str, trimmedStr, options) {
  if (!options.eNotation) return str;
  const notation = trimmedStr.match(eNotationRegx);
  if (notation) {
    let sign = notation[1] || "";
    const eChar = notation[3].indexOf("e") === -1 ? "E" : "e";
    const leadingZeros = notation[2];
    const eAdjacentToLeadingZeros = sign ? (
      // 0E.
      str[leadingZeros.length + 1] === eChar
    ) : str[leadingZeros.length] === eChar;
    if (leadingZeros.length > 1 && eAdjacentToLeadingZeros) return str;
    else if (leadingZeros.length === 1 && (notation[3].startsWith(`.${eChar}`) || notation[3][0] === eChar)) {
      return Number(trimmedStr);
    } else if (leadingZeros.length > 0) {
      if (options.leadingZeros && !eAdjacentToLeadingZeros) {
        trimmedStr = (notation[1] || "") + notation[3];
        return Number(trimmedStr);
      } else return str;
    } else {
      return Number(trimmedStr);
    }
  } else {
    return str;
  }
}
function trimZeros(numStr) {
  if (numStr && numStr.indexOf(".") !== -1) {
    let end = numStr.length;
    while (end > 0 && numStr.charCodeAt(end - 1) === 48) end--;
    numStr = numStr.slice(0, end);
    if (numStr === ".") numStr = "0";
    else if (numStr[0] === ".") numStr = "0" + numStr;
    else if (numStr[numStr.length - 1] === ".") numStr = numStr.substring(0, numStr.length - 1);
    return numStr;
  }
  return numStr;
}
function parse_int(numStr, base) {
  const str = numStr.trim();
  if (base === 2 || base === 8) numStr = str.substring(2);
  if (parseInt) return parseInt(numStr, base);
  else if (Number.parseInt) return Number.parseInt(numStr, base);
  else if (window && window.parseInt) return window.parseInt(numStr, base);
  else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
}
function handleInfinity(str, num, options) {
  const isPositive = num === Infinity;
  switch (options.infinity.toLowerCase()) {
    case "null":
      return null;
    case "infinity":
      return num;
    // Return Infinity or -Infinity
    case "string":
      return isPositive ? "Infinity" : "-Infinity";
    case "original":
    default:
      return str;
  }
}

// ../verify/node_modules/fast-xml-parser/src/ignoreAttributes.js
function getIgnoreAttributesFn(ignoreAttributes) {
  if (typeof ignoreAttributes === "function") {
    return ignoreAttributes;
  }
  if (Array.isArray(ignoreAttributes)) {
    return (attrName) => {
      for (const pattern of ignoreAttributes) {
        if (typeof pattern === "string" && attrName === pattern) {
          return true;
        }
        if (pattern instanceof RegExp && pattern.test(attrName)) {
          return true;
        }
      }
    };
  }
  return () => false;
}

// ../verify/node_modules/path-expression-matcher/src/Expression.js
var Expression = class {
  /**
   * Create a new Expression
   * @param {string} pattern - Pattern string (e.g., "root.users.user", "..user[id]")
   * @param {Object} options - Configuration options
   * @param {string} options.separator - Path separator (default: '.')
   */
  constructor(pattern, options = {}, data) {
    this.pattern = pattern;
    this.separator = options.separator || ".";
    this.segments = this._parse(pattern);
    this.data = data;
    this._hasDeepWildcard = this.segments.some((seg) => seg.type === "deep-wildcard");
    this._hasAttributeCondition = this.segments.some((seg) => seg.attrName !== void 0);
    this._hasPositionSelector = this.segments.some((seg) => seg.position !== void 0);
  }
  /**
   * Parse pattern string into segments
   * @private
   * @param {string} pattern - Pattern to parse
   * @returns {Array} Array of segment objects
   */
  _parse(pattern) {
    const segments = [];
    let i = 0;
    let currentPart = "";
    while (i < pattern.length) {
      if (pattern[i] === this.separator) {
        if (i + 1 < pattern.length && pattern[i + 1] === this.separator) {
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
            currentPart = "";
          }
          segments.push({ type: "deep-wildcard" });
          i += 2;
        } else {
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
          }
          currentPart = "";
          i++;
        }
      } else {
        currentPart += pattern[i];
        i++;
      }
    }
    if (currentPart.trim()) {
      segments.push(this._parseSegment(currentPart.trim()));
    }
    return segments;
  }
  /**
   * Parse a single segment
   * @private
   * @param {string} part - Segment string (e.g., "user", "ns::user", "user[id]", "ns::user:first")
   * @returns {Object} Segment object
   */
  _parseSegment(part) {
    const segment = { type: "tag" };
    let bracketContent = null;
    let withoutBrackets = part;
    const bracketMatch = part.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
    if (bracketMatch) {
      withoutBrackets = bracketMatch[1] + bracketMatch[3];
      if (bracketMatch[2]) {
        const content = bracketMatch[2].slice(1, -1);
        if (content) {
          bracketContent = content;
        }
      }
    }
    let namespace = void 0;
    let tagAndPosition = withoutBrackets;
    if (withoutBrackets.includes("::")) {
      const nsIndex = withoutBrackets.indexOf("::");
      namespace = withoutBrackets.substring(0, nsIndex).trim();
      tagAndPosition = withoutBrackets.substring(nsIndex + 2).trim();
      if (!namespace) {
        throw new Error(`Invalid namespace in pattern: ${part}`);
      }
    }
    let tag = void 0;
    let positionMatch = null;
    if (tagAndPosition.includes(":")) {
      const colonIndex = tagAndPosition.lastIndexOf(":");
      const tagPart = tagAndPosition.substring(0, colonIndex).trim();
      const posPart = tagAndPosition.substring(colonIndex + 1).trim();
      const isPositionKeyword = ["first", "last", "odd", "even"].includes(posPart) || /^nth\(\d+\)$/.test(posPart);
      if (isPositionKeyword) {
        tag = tagPart;
        positionMatch = posPart;
      } else {
        tag = tagAndPosition;
      }
    } else {
      tag = tagAndPosition;
    }
    if (!tag) {
      throw new Error(`Invalid segment pattern: ${part}`);
    }
    segment.tag = tag;
    if (namespace) {
      segment.namespace = namespace;
    }
    if (bracketContent) {
      if (bracketContent.includes("=")) {
        const eqIndex = bracketContent.indexOf("=");
        segment.attrName = bracketContent.substring(0, eqIndex).trim();
        segment.attrValue = bracketContent.substring(eqIndex + 1).trim();
      } else {
        segment.attrName = bracketContent.trim();
      }
    }
    if (positionMatch) {
      const nthMatch = positionMatch.match(/^nth\((\d+)\)$/);
      if (nthMatch) {
        segment.position = "nth";
        segment.positionValue = parseInt(nthMatch[1], 10);
      } else {
        segment.position = positionMatch;
      }
    }
    return segment;
  }
  /**
   * Get the number of segments
   * @returns {number}
   */
  get length() {
    return this.segments.length;
  }
  /**
   * Check if expression contains deep wildcard
   * @returns {boolean}
   */
  hasDeepWildcard() {
    return this._hasDeepWildcard;
  }
  /**
   * Check if expression has attribute conditions
   * @returns {boolean}
   */
  hasAttributeCondition() {
    return this._hasAttributeCondition;
  }
  /**
   * Check if expression has position selectors
   * @returns {boolean}
   */
  hasPositionSelector() {
    return this._hasPositionSelector;
  }
  /**
   * Get string representation
   * @returns {string}
   */
  toString() {
    return this.pattern;
  }
};

// ../verify/node_modules/path-expression-matcher/src/ExpressionSet.js
var ExpressionSet = class {
  constructor() {
    this._byDepthAndTag = /* @__PURE__ */ new Map();
    this._wildcardByDepth = /* @__PURE__ */ new Map();
    this._deepWildcards = [];
    this._deepByTerminalTag = /* @__PURE__ */ new Map();
    this._patterns = /* @__PURE__ */ new Set();
    this._sealed = false;
  }
  /**
   * Add an Expression to the set.
   * Duplicate patterns (same pattern string) are silently ignored.
   *
   * @param {import('./Expression.js').default} expression - A pre-constructed Expression instance
   * @returns {this} for chaining
   * @throws {TypeError} if called after seal()
   *
   * @example
   * set.add(new Expression('root.users.user'));
   * set.add(new Expression('..script'));
   */
  add(expression) {
    if (this._sealed) {
      throw new TypeError(
        "ExpressionSet is sealed. Create a new ExpressionSet to add more expressions."
      );
    }
    if (this._patterns.has(expression.pattern)) return this;
    this._patterns.add(expression.pattern);
    if (expression.hasDeepWildcard()) {
      const lastSeg2 = expression.segments[expression.segments.length - 1];
      if (lastSeg2 && lastSeg2.type !== "deep-wildcard" && lastSeg2.tag !== "*") {
        const tag2 = lastSeg2.tag;
        if (!this._deepByTerminalTag.has(tag2)) this._deepByTerminalTag.set(tag2, []);
        this._deepByTerminalTag.get(tag2).push(expression);
      } else {
        this._deepWildcards.push(expression);
      }
      return this;
    }
    const depth = expression.length;
    const lastSeg = expression.segments[expression.segments.length - 1];
    const tag = lastSeg?.tag;
    if (!tag || tag === "*") {
      if (!this._wildcardByDepth.has(depth)) this._wildcardByDepth.set(depth, []);
      this._wildcardByDepth.get(depth).push(expression);
    } else {
      const key = `${depth}:${tag}`;
      if (!this._byDepthAndTag.has(key)) this._byDepthAndTag.set(key, []);
      this._byDepthAndTag.get(key).push(expression);
    }
    return this;
  }
  /**
   * Add multiple expressions at once.
   *
   * @param {import('./Expression.js').default[]} expressions - Array of Expression instances
   * @returns {this} for chaining
   *
   * @example
   * set.addAll([
   *   new Expression('root.users.user'),
   *   new Expression('root.config.setting'),
   * ]);
   */
  addAll(expressions) {
    for (const expr of expressions) this.add(expr);
    return this;
  }
  /**
   * Check whether a pattern string is already present in the set.
   *
   * @param {import('./Expression.js').default} expression
   * @returns {boolean}
   */
  has(expression) {
    return this._patterns.has(expression.pattern);
  }
  /**
   * Number of expressions in the set.
   * @type {number}
   */
  get size() {
    return this._patterns.size;
  }
  /**
   * Seal the set against further modifications.
   * Useful to prevent accidental mutations after config is built.
   * Calling add() or addAll() on a sealed set throws a TypeError.
   *
   * @returns {this}
   */
  seal() {
    this._sealed = true;
    return this;
  }
  /**
   * Whether the set has been sealed.
   * @type {boolean}
   */
  get isSealed() {
    return this._sealed;
  }
  /**
   * Test whether the matcher's current path matches any expression in the set.
   *
   * Evaluation order (cheapest → most expensive):
   *  1. Exact depth + tag bucket  — O(1) lookup, typically 0–2 expressions
   *  2. Depth-only wildcard bucket — O(1) lookup, rare
   *  3. Deep-wildcard list         — always checked, but usually small
   *
   * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
   * @returns {boolean} true if any expression matches the current path
   *
   * @example
   * if (stopNodes.matchesAny(matcher)) {
   *   // handle stop node
   * }
   */
  matchesAny(matcher) {
    return this.findMatch(matcher) !== null;
  }
  /**
  * Find and return the first Expression that matches the matcher's current path.
  *
  * Uses the same evaluation order as matchesAny (cheapest → most expensive):
  *  1. Exact depth + tag bucket
  *  2. Depth-only wildcard bucket
  *  3. Deep-wildcard list
  *
  * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
  * @returns {import('./Expression.js').default | null} the first matching Expression, or null
  *
  * @example
  * const expr = stopNodes.findMatch(matcher);
  * if (expr) {
  *   // access expr.config, expr.pattern, etc.
  * }
  */
  findMatch(matcher) {
    const depth = matcher.getDepth();
    const tag = matcher.getCurrentTag();
    const exactKey = `${depth}:${tag}`;
    const exactBucket = this._byDepthAndTag.get(exactKey);
    if (exactBucket) {
      for (let i = 0; i < exactBucket.length; i++) {
        if (matcher.matches(exactBucket[i])) return exactBucket[i];
      }
    }
    const wildcardBucket = this._wildcardByDepth.get(depth);
    if (wildcardBucket) {
      for (let i = 0; i < wildcardBucket.length; i++) {
        if (matcher.matches(wildcardBucket[i])) return wildcardBucket[i];
      }
    }
    const deepBucket = this._deepByTerminalTag.get(tag);
    if (deepBucket) {
      for (let i = 0; i < deepBucket.length; i++) {
        if (matcher.matches(deepBucket[i])) return deepBucket[i];
      }
    }
    for (let i = 0; i < this._deepWildcards.length; i++) {
      if (matcher.matches(this._deepWildcards[i])) return this._deepWildcards[i];
    }
    return null;
  }
};

// ../verify/node_modules/path-expression-matcher/src/Matcher.js
var MatcherView = class {
  /**
   * @param {Matcher} matcher - The parent Matcher instance to read from.
   */
  constructor(matcher) {
    this._matcher = matcher;
  }
  /**
   * Get the path separator used by the parent matcher.
   * @returns {string}
   */
  get separator() {
    return this._matcher.separator;
  }
  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    const path = this._matcher.path;
    return path.length > 0 ? path[path.length - 1].tag : void 0;
  }
  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    const path = this._matcher.path;
    return path.length > 0 ? path[path.length - 1].namespace : void 0;
  }
  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    const path = this._matcher.path;
    if (path.length === 0) return void 0;
    return path[path.length - 1].values?.[attrName];
  }
  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    const path = this._matcher.path;
    if (path.length === 0) return false;
    const current = path[path.length - 1];
    return current.values !== void 0 && attrName in current.values;
  }
  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {*}
   */
  getAnyParentAttr(attrName) {
    return this._matcher.getAnyParentAttr(attrName);
  }
  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    return this._matcher.hasAnyParentAttr(attrName);
  }
  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    const path = this._matcher.path;
    if (path.length === 0) return -1;
    return path[path.length - 1].position ?? 0;
  }
  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    const path = this._matcher.path;
    if (path.length === 0) return -1;
    return path[path.length - 1].counter ?? 0;
  }
  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }
  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this._matcher.path.length;
  }
  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    return this._matcher.toString(separator, includeNamespace);
  }
  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this._matcher.path.map((n) => n.tag);
  }
  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    return this._matcher.matches(expression);
  }
  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this._matcher);
  }
};
var Matcher = class {
  /**
   * Create a new Matcher.
   * @param {Object} [options={}]
   * @param {string} [options.separator='.'] - Default path separator
   */
  constructor(options = {}) {
    this.separator = options.separator || ".";
    this.path = [];
    this.siblingStacks = [];
    this._pathStringCache = null;
    this._view = new MatcherView(this);
    this._keptAttrs = [];
  }
  /**
   * Push a new tag onto the path.
   * @param {string} tagName
   * @param {Object|null} [attrValues=null]
   * @param {string|null} [namespace=null]
   * @param {Object|null} [options=null]
   * @param {string[]} [options.keep] - Names of attributes (from attrValues)
   */
  push(tagName, attrValues = null, namespace = null, options = null) {
    this._pathStringCache = null;
    if (this.path.length > 0) {
      this.path[this.path.length - 1].values = void 0;
    }
    const currentLevel = this.path.length;
    let level = this.siblingStacks[currentLevel];
    if (!level) {
      level = { counts: /* @__PURE__ */ new Map(), total: 0 };
      this.siblingStacks[currentLevel] = level;
    }
    const siblingKey = namespace ? `${namespace}:${tagName}` : tagName;
    const counter = level.counts.get(siblingKey) || 0;
    const position = level.total;
    level.counts.set(siblingKey, counter + 1);
    level.total++;
    const node = {
      tag: tagName,
      position,
      counter
    };
    if (namespace !== null && namespace !== void 0) {
      node.namespace = namespace;
    }
    if (attrValues !== null && attrValues !== void 0) {
      node.values = attrValues;
    }
    this.path.push(node);
    const depth = this.path.length;
    const keep = options !== null ? options.keep : null;
    if (keep !== null && keep !== void 0 && keep.length > 0 && attrValues) {
      for (let i = 0; i < keep.length; i++) {
        const name = keep[i];
        if (attrValues[name] !== void 0) {
          this._keptAttrs.push({ depth, name, value: attrValues[name] });
        }
      }
    }
  }
  /**
   * Pop the last tag from the path.
   * @returns {Object|undefined} The popped node
   */
  pop() {
    if (this.path.length === 0) return void 0;
    this._pathStringCache = null;
    const node = this.path.pop();
    if (this.siblingStacks.length > this.path.length + 1) {
      this.siblingStacks.length = this.path.length + 1;
    }
    const poppedDepth = this.path.length + 1;
    while (this._keptAttrs.length > 0 && this._keptAttrs[this._keptAttrs.length - 1].depth >= poppedDepth) {
      this._keptAttrs.pop();
    }
    return node;
  }
  /**
   * Update current node's attribute values.
   * Useful when attributes are parsed after push.
   * @param {Object} attrValues
   */
  updateCurrent(attrValues) {
    if (this.path.length > 0) {
      const current = this.path[this.path.length - 1];
      if (attrValues !== null && attrValues !== void 0) {
        current.values = attrValues;
      }
    }
  }
  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    return this.path.length > 0 ? this.path[this.path.length - 1].tag : void 0;
  }
  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    return this.path.length > 0 ? this.path[this.path.length - 1].namespace : void 0;
  }
  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    if (this.path.length === 0) return void 0;
    return this.path[this.path.length - 1].values?.[attrName];
  }
  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    if (this.path.length === 0) return false;
    const current = this.path[this.path.length - 1];
    return current.values !== void 0 && attrName in current.values;
  }
  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * Unlike getAttrValue(), this works regardless of how deep the path has
   * gone since the attribute was pushed — but only for attribute names that
   * were explicitly marked with `keep` at push time. Cost is proportional to
   * the number of currently-kept attributes (typically 0-3), not path depth.
   * @param {string} attrName
   * @returns {*} the value, or undefined if no ancestor kept this attribute
   */
  getAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].name === attrName) return kept[i].value;
    }
    return void 0;
  }
  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].name === attrName) return true;
    }
    return false;
  }
  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].position ?? 0;
  }
  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].counter ?? 0;
  }
  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }
  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this.path.length;
  }
  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    const sep = separator || this.separator;
    const isDefault = sep === this.separator && includeNamespace === true;
    if (isDefault) {
      if (this._pathStringCache !== null) {
        return this._pathStringCache;
      }
      const result = this.path.map(
        (n) => n.namespace ? `${n.namespace}:${n.tag}` : n.tag
      ).join(sep);
      this._pathStringCache = result;
      return result;
    }
    return this.path.map(
      (n) => includeNamespace && n.namespace ? `${n.namespace}:${n.tag}` : n.tag
    ).join(sep);
  }
  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this.path.map((n) => n.tag);
  }
  /**
   * Reset the path to empty.
   */
  reset() {
    this._pathStringCache = null;
    this.path = [];
    this.siblingStacks = [];
    this._keptAttrs = [];
  }
  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    const segments = expression.segments;
    if (segments.length === 0) {
      return false;
    }
    if (expression.hasDeepWildcard()) {
      return this._matchWithDeepWildcard(segments);
    }
    return this._matchSimple(segments);
  }
  /**
   * @private
   */
  _matchSimple(segments) {
    if (this.path.length !== segments.length) {
      return false;
    }
    for (let i = 0; i < segments.length; i++) {
      if (!this._matchSegment(segments[i], this.path[i], i === this.path.length - 1)) {
        return false;
      }
    }
    return true;
  }
  /**
   * @private
   */
  _matchWithDeepWildcard(segments) {
    let pathIdx = this.path.length - 1;
    let segIdx = segments.length - 1;
    while (segIdx >= 0 && pathIdx >= 0) {
      const segment = segments[segIdx];
      if (segment.type === "deep-wildcard") {
        segIdx--;
        if (segIdx < 0) {
          return true;
        }
        const nextSeg = segments[segIdx];
        let found = false;
        for (let i = pathIdx; i >= 0; i--) {
          if (this._matchSegment(nextSeg, this.path[i], i === this.path.length - 1)) {
            pathIdx = i - 1;
            segIdx--;
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      } else {
        if (!this._matchSegment(segment, this.path[pathIdx], pathIdx === this.path.length - 1)) {
          return false;
        }
        pathIdx--;
        segIdx--;
      }
    }
    return segIdx < 0;
  }
  /**
   * @private
   */
  _matchSegment(segment, node, isCurrentNode) {
    if (segment.tag !== "*" && segment.tag !== node.tag) {
      return false;
    }
    if (segment.namespace !== void 0) {
      if (segment.namespace !== "*" && segment.namespace !== node.namespace) {
        return false;
      }
    }
    if (segment.attrName !== void 0) {
      if (!isCurrentNode) {
        return false;
      }
      if (!node.values || !(segment.attrName in node.values)) {
        return false;
      }
      if (segment.attrValue !== void 0) {
        if (String(node.values[segment.attrName]) !== String(segment.attrValue)) {
          return false;
        }
      }
    }
    if (segment.position !== void 0) {
      if (!isCurrentNode) {
        return false;
      }
      const counter = node.counter ?? 0;
      if (segment.position === "first" && counter !== 0) {
        return false;
      } else if (segment.position === "odd" && counter % 2 !== 1) {
        return false;
      } else if (segment.position === "even" && counter % 2 !== 0) {
        return false;
      } else if (segment.position === "nth" && counter !== segment.positionValue) {
        return false;
      }
    }
    return true;
  }
  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this);
  }
  /**
   * Create a snapshot of current state.
   * @returns {Object}
   */
  snapshot() {
    return {
      path: this.path.map((node) => ({ ...node })),
      siblingStacks: this.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level),
      keptAttrs: this._keptAttrs.map((entry) => ({ ...entry }))
    };
  }
  /**
   * Restore state from snapshot.
   * @param {Object} snapshot
   */
  restore(snapshot) {
    this._pathStringCache = null;
    this.path = snapshot.path.map((node) => ({ ...node }));
    this.siblingStacks = snapshot.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level);
    this._keptAttrs = (snapshot.keptAttrs || []).map((entry) => ({ ...entry }));
  }
  /**
   * Return the read-only {@link MatcherView} for this matcher.
   *
   * The same instance is returned on every call — no allocation occurs.
   * It always reflects the current parser state and is safe to pass to
   * user callbacks without risk of accidental mutation.
   *
   * @returns {MatcherView}
   *
   * @example
   * const view = matcher.readOnly();
   * // pass view to callbacks — it stays in sync automatically
   * view.matches(expr);       // ✓
   * view.getCurrentTag();     // ✓
   * // view.push(...)         // ✗ method does not exist — caught by TypeScript
   */
  readOnly() {
    return this._view;
  }
};

// ../verify/node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
function extractRawAttributes(prefixedAttrs, options) {
  if (!prefixedAttrs) return {};
  const attrs = options.attributesGroupName ? prefixedAttrs[options.attributesGroupName] : prefixedAttrs;
  if (!attrs) return {};
  const rawAttrs = {};
  for (const key in attrs) {
    if (key.startsWith(options.attributeNamePrefix)) {
      const rawName = key.substring(options.attributeNamePrefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}
function extractNamespace(rawTagName) {
  if (!rawTagName || typeof rawTagName !== "string") return void 0;
  const colonIndex = rawTagName.indexOf(":");
  if (colonIndex !== -1 && colonIndex > 0) {
    const ns = rawTagName.substring(0, colonIndex);
    if (ns !== "xmlns") {
      return ns;
    }
  }
  return void 0;
}
var OrderedObjParser = class {
  constructor(options) {
    this.options = options;
    this.currentNode = null;
    this.tagsNodeStack = [];
    this.parseXml = parseXml;
    this.parseTextData = parseTextData;
    this.resolveNameSpace = resolveNameSpace;
    this.buildAttributesMap = buildAttributesMap;
    this.isItStopNode = isItStopNode;
    this.replaceEntitiesValue = replaceEntitiesValue;
    this.readStopNodeData = readStopNodeData;
    this.saveTextToParentTag = saveTextToParentTag;
    this.addChild = addChild;
    this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
    this.entityExpansionCount = 0;
    this.currentExpandedLength = 0;
    let namedEntities = { ...XML };
    if (this.options.entityDecoder) {
      this.entityDecoder = this.options.entityDecoder;
    } else {
      if (typeof this.options.htmlEntities === "object") namedEntities = this.options.htmlEntities;
      else if (this.options.htmlEntities === true) namedEntities = { ...COMMON_HTML, ...CURRENCY };
      this.entityDecoder = new EntityDecoder({
        namedEntities,
        numericAllowed: this.options.htmlEntities,
        limit: {
          maxTotalExpansions: this.options.processEntities.maxTotalExpansions,
          maxExpandedLength: this.options.processEntities.maxExpandedLength,
          applyLimitsTo: this.options.processEntities.appliesTo
        }
        //postCheck: resolved => resolved
      });
    }
    this.matcher = new Matcher();
    this.readonlyMatcher = this.matcher.readOnly();
    this.isCurrentNodeStopNode = false;
    this.stopNodeExpressionsSet = new ExpressionSet();
    const stopNodesOpts = this.options.stopNodes;
    if (stopNodesOpts && stopNodesOpts.length > 0) {
      for (let i = 0; i < stopNodesOpts.length; i++) {
        const stopNodeExp = stopNodesOpts[i];
        if (typeof stopNodeExp === "string") {
          this.stopNodeExpressionsSet.add(new Expression(stopNodeExp));
        } else if (stopNodeExp instanceof Expression) {
          this.stopNodeExpressionsSet.add(stopNodeExp);
        }
      }
      this.stopNodeExpressionsSet.seal();
    }
  }
};
function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
  const options = this.options;
  if (val !== void 0) {
    if (options.trimValues && !dontTrim) {
      val = val.trim();
    }
    if (val.length > 0) {
      if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
      const jPathOrMatcher = options.jPath ? jPath.toString() : jPath;
      const newval = options.tagValueProcessor(tagName, val, jPathOrMatcher, hasAttributes, isLeafNode);
      if (newval === null || newval === void 0) {
        return val;
      } else if (typeof newval !== typeof val || newval !== val) {
        return newval;
      } else if (options.trimValues) {
        return parseValue(val, options.parseTagValue, options.numberParseOptions);
      } else {
        const trimmedVal = val.trim();
        if (trimmedVal === val) {
          return parseValue(val, options.parseTagValue, options.numberParseOptions);
        } else {
          return val;
        }
      }
    }
  }
}
function resolveNameSpace(tagname) {
  if (this.options.removeNSPrefix) {
    const tags = tagname.split(":");
    const prefix = tagname.charAt(0) === "/" ? "/" : "";
    if (tags[0] === "xmlns") {
      return "";
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}
var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
function buildAttributesMap(attrStr, jPath, tagName, force = false) {
  const options = this.options;
  if (force === true || options.ignoreAttributes !== true && typeof attrStr === "string") {
    const matches = getAllMatches(attrStr, attrsRegx);
    const len = matches.length;
    const attrs = {};
    const processedVals = new Array(len);
    let hasRawAttrs = false;
    const rawAttrsForMatcher = {};
    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);
      const oldVal = matches[i][4];
      if (attrName.length && oldVal !== void 0) {
        let val = oldVal;
        if (options.trimValues) val = val.trim();
        val = this.replaceEntitiesValue(val, tagName, this.readonlyMatcher);
        processedVals[i] = val;
        rawAttrsForMatcher[attrName] = val;
        hasRawAttrs = true;
      }
    }
    if (hasRawAttrs && typeof jPath === "object" && jPath.updateCurrent) {
      jPath.updateCurrent(rawAttrsForMatcher);
    }
    const jPathStr = options.jPath ? jPath.toString() : this.readonlyMatcher;
    let hasAttrs = false;
    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);
      if (this.ignoreAttributesFn(attrName, jPathStr)) continue;
      let aName = options.attributeNamePrefix + attrName;
      if (attrName.length) {
        if (options.transformAttributeName) {
          aName = options.transformAttributeName(aName);
        }
        aName = sanitizeName(aName, options);
        if (matches[i][4] !== void 0) {
          const oldVal = processedVals[i];
          const newVal = options.attributeValueProcessor(attrName, oldVal, jPathStr);
          if (newVal === null || newVal === void 0) {
            attrs[aName] = oldVal;
          } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
            attrs[aName] = newVal;
          } else {
            attrs[aName] = parseValue(oldVal, options.parseAttributeValue, options.numberParseOptions);
          }
          hasAttrs = true;
        } else if (options.allowBooleanAttributes) {
          attrs[aName] = true;
          hasAttrs = true;
        }
      }
    }
    if (!hasAttrs) return;
    if (options.attributesGroupName) {
      const attrCollection = {};
      attrCollection[options.attributesGroupName] = attrs;
      return attrCollection;
    }
    return attrs;
  }
}
var parseXml = function(xmlData) {
  xmlData = xmlData.replace(/\r\n?/g, "\n");
  const xmlObj = new XmlNode("!xml");
  let currentNode = xmlObj;
  let textData = "";
  this.matcher.reset();
  this.entityDecoder.reset();
  this.entityExpansionCount = 0;
  this.currentExpandedLength = 0;
  const options = this.options;
  const docTypeReader = new DocTypeReader(options.processEntities);
  const xmlLen = xmlData.length;
  for (let i = 0; i < xmlLen; i++) {
    const ch = xmlData[i];
    if (ch === "<") {
      const c1 = xmlData.charCodeAt(i + 1);
      if (c1 === 47) {
        const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
        let tagName = xmlData.substring(i + 2, closeIndex).trim();
        if (options.removeNSPrefix) {
          const colonIndex = tagName.indexOf(":");
          if (colonIndex !== -1) {
            tagName = tagName.substr(colonIndex + 1);
          }
        }
        tagName = transformTagName(options.transformTagName, tagName, "", options).tagName;
        if (currentNode) {
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        }
        const lastTagName = this.matcher.getCurrentTag();
        if (tagName && options.unpairedTagsSet.has(tagName)) {
          throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
        }
        if (lastTagName && options.unpairedTagsSet.has(lastTagName)) {
          this.matcher.pop();
          this.tagsNodeStack.pop();
        }
        this.matcher.pop();
        this.isCurrentNodeStopNode = false;
        currentNode = this.tagsNodeStack.pop();
        textData = "";
        i = closeIndex;
      } else if (c1 === 63) {
        let tagData = readTagExp(xmlData, i, false, "?>");
        if (!tagData) throw new Error("Pi Tag is not closed.");
        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        const attsMap = this.buildAttributesMap(tagData.tagExp, this.matcher, tagData.tagName, true);
        if (attsMap) {
          const ver = attsMap[this.options.attributeNamePrefix + "version"];
          this.entityDecoder.setXmlVersion(Number(ver) || 1);
        }
        if (options.ignoreDeclaration && tagData.tagName === "?xml" || options.ignorePiTags) {
        } else {
          const childNode = new XmlNode(tagData.tagName);
          childNode.add(options.textNodeName, "");
          if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent && options.ignoreAttributes !== true) {
            childNode[":@"] = attsMap;
          }
          this.addChild(currentNode, childNode, this.readonlyMatcher, i);
        }
        i = tagData.closeIndex + 1;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 45 && xmlData.charCodeAt(i + 3) === 45) {
        const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.");
        if (options.commentPropName) {
          const comment = xmlData.substring(i + 4, endIndex - 2);
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
          currentNode.add(options.commentPropName, [{ [options.textNodeName]: comment }]);
        }
        i = endIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 68) {
        const result = docTypeReader.readDocType(xmlData, i);
        this.entityDecoder.addInputEntities(result.entities);
        i = result.i;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 91) {
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
        const tagExp = xmlData.substring(i + 9, closeIndex);
        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        let val = this.parseTextData(tagExp, currentNode.tagname, this.readonlyMatcher, true, false, true, true);
        if (val == void 0) val = "";
        if (options.cdataPropName) {
          currentNode.add(options.cdataPropName, [{ [options.textNodeName]: tagExp }]);
        } else {
          currentNode.add(options.textNodeName, val);
        }
        i = closeIndex + 2;
      } else {
        let result = readTagExp(xmlData, i, options.removeNSPrefix);
        if (!result) {
          const context = xmlData.substring(Math.max(0, i - 50), Math.min(xmlLen, i + 50));
          throw new Error(`readTagExp returned undefined at position ${i}. Context: "${context}"`);
        }
        let tagName = result.tagName;
        const rawTagName = result.rawTagName;
        let tagExp = result.tagExp;
        let attrExpPresent = result.attrExpPresent;
        let closeIndex = result.closeIndex;
        ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
        if (options.strictReservedNames && (tagName === options.commentPropName || tagName === options.cdataPropName || tagName === options.textNodeName || tagName === options.attributesGroupName)) {
          throw new Error(`Invalid tag name: ${tagName}`);
        }
        if (currentNode && textData) {
          if (currentNode.tagname !== "!xml") {
            textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher, false);
          }
        }
        const lastTag = currentNode;
        if (lastTag && options.unpairedTagsSet.has(lastTag.tagname)) {
          currentNode = this.tagsNodeStack.pop();
          this.matcher.pop();
        }
        let isSelfClosing = false;
        if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
          isSelfClosing = true;
          if (tagName[tagName.length - 1] === "/") {
            tagName = tagName.substr(0, tagName.length - 1);
            tagExp = tagName;
          } else {
            tagExp = tagExp.substr(0, tagExp.length - 1);
          }
          attrExpPresent = tagName !== tagExp;
        }
        let prefixedAttrs = null;
        let rawAttrs = {};
        let namespace = void 0;
        namespace = extractNamespace(rawTagName);
        if (tagName !== xmlObj.tagname) {
          this.matcher.push(tagName, {}, namespace);
        }
        if (tagName !== tagExp && attrExpPresent) {
          prefixedAttrs = this.buildAttributesMap(tagExp, this.matcher, tagName);
          if (prefixedAttrs) {
            rawAttrs = extractRawAttributes(prefixedAttrs, options);
          }
        }
        if (tagName !== xmlObj.tagname) {
          this.isCurrentNodeStopNode = this.isItStopNode();
        }
        const startIndex = i;
        if (this.isCurrentNodeStopNode) {
          let tagContent = "";
          if (isSelfClosing) {
            i = result.closeIndex;
          } else if (options.unpairedTagsSet.has(tagName)) {
            i = result.closeIndex;
          } else {
            const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
            if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
            i = result2.i;
            tagContent = result2.tagContent;
          }
          const childNode = new XmlNode(tagName);
          if (prefixedAttrs) {
            childNode[":@"] = prefixedAttrs;
          }
          childNode.add(options.textNodeName, tagContent);
          this.matcher.pop();
          this.isCurrentNodeStopNode = false;
          this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
        } else {
          if (isSelfClosing) {
            ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            this.matcher.pop();
            this.isCurrentNodeStopNode = false;
          } else if (options.unpairedTagsSet.has(tagName)) {
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            this.matcher.pop();
            this.isCurrentNodeStopNode = false;
            i = result.closeIndex;
            continue;
          } else {
            const childNode = new XmlNode(tagName);
            if (this.tagsNodeStack.length > options.maxNestedTags) {
              throw new Error("Maximum nested tags exceeded");
            }
            this.tagsNodeStack.push(currentNode);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            currentNode = childNode;
          }
          textData = "";
          i = closeIndex;
        }
      }
    } else {
      textData += xmlData[i];
    }
  }
  return xmlObj.child;
};
function addChild(currentNode, childNode, matcher, startIndex) {
  if (!this.options.captureMetaData) startIndex = void 0;
  const jPathOrMatcher = this.options.jPath ? matcher.toString() : matcher;
  const result = this.options.updateTag(childNode.tagname, jPathOrMatcher, childNode[":@"]);
  if (result === false) {
  } else if (typeof result === "string") {
    childNode.tagname = result;
    currentNode.addChild(childNode, startIndex);
  } else {
    currentNode.addChild(childNode, startIndex);
  }
}
function replaceEntitiesValue(val, tagName, jPath) {
  const entityConfig = this.options.processEntities;
  if (!entityConfig || !entityConfig.enabled) {
    return val;
  }
  if (entityConfig.allowedTags) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    const allowed = Array.isArray(entityConfig.allowedTags) ? entityConfig.allowedTags.includes(tagName) : entityConfig.allowedTags(tagName, jPathOrMatcher);
    if (!allowed) {
      return val;
    }
  }
  if (entityConfig.tagFilter) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    if (!entityConfig.tagFilter(tagName, jPathOrMatcher)) {
      return val;
    }
  }
  return this.entityDecoder.decode(val);
}
function saveTextToParentTag(textData, parentNode, matcher, isLeafNode) {
  if (textData) {
    if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
    textData = this.parseTextData(
      textData,
      parentNode.tagname,
      matcher,
      false,
      parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
      isLeafNode
    );
    if (textData !== void 0 && textData !== "")
      parentNode.add(this.options.textNodeName, textData);
    textData = "";
  }
  return textData;
}
function isItStopNode() {
  if (this.stopNodeExpressionsSet.size === 0) return false;
  return this.matcher.matchesAny(this.stopNodeExpressionsSet);
}
function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
  let attrBoundary = 0;
  const chars = [];
  const len = xmlData.length;
  const closeCode0 = closingChar.charCodeAt(0);
  const closeCode1 = closingChar.length > 1 ? closingChar.charCodeAt(1) : -1;
  for (let index = i; index < len; index++) {
    const code = xmlData.charCodeAt(index);
    if (attrBoundary) {
      if (code === attrBoundary) attrBoundary = 0;
    } else if (code === 34 || code === 39) {
      attrBoundary = code;
    } else if (code === closeCode0) {
      if (closeCode1 !== -1) {
        if (xmlData.charCodeAt(index + 1) === closeCode1) {
          return { data: String.fromCharCode(...chars), index };
        }
      } else {
        return { data: String.fromCharCode(...chars), index };
      }
    } else if (code === 9) {
      chars.push(32);
      continue;
    }
    chars.push(code);
  }
}
function findClosingIndex(xmlData, str, i, errMsg) {
  const closingIndex = xmlData.indexOf(str, i);
  if (closingIndex === -1) {
    throw new Error(errMsg);
  } else {
    return closingIndex + str.length - 1;
  }
}
function findClosingChar(xmlData, char, i, errMsg) {
  const closingIndex = xmlData.indexOf(char, i);
  if (closingIndex === -1) throw new Error(errMsg);
  return closingIndex;
}
function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
  const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
  if (!result) return;
  let tagExp = result.data;
  const closeIndex = result.index;
  const separatorIndex = tagExp.search(/\s/);
  let tagName = tagExp;
  let attrExpPresent = true;
  if (separatorIndex !== -1) {
    tagName = tagExp.substring(0, separatorIndex);
    tagExp = tagExp.substring(separatorIndex + 1).trimStart();
  }
  const rawTagName = tagName;
  if (removeNSPrefix) {
    const colonIndex = tagName.indexOf(":");
    if (colonIndex !== -1) {
      tagName = tagName.substr(colonIndex + 1);
      attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
    }
  }
  return {
    tagName,
    tagExp,
    closeIndex,
    attrExpPresent,
    rawTagName
  };
}
function readStopNodeData(xmlData, tagName, i) {
  const startIndex = i;
  let openTagCount = 1;
  const xmllen = xmlData.length;
  for (; i < xmllen; i++) {
    if (xmlData[i] === "<") {
      const c1 = xmlData.charCodeAt(i + 1);
      if (c1 === 47) {
        const closeIndex = findClosingChar(xmlData, ">", i, `${tagName} is not closed`);
        let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
        if (closeTagName === tagName) {
          openTagCount--;
          if (openTagCount === 0) {
            return {
              tagContent: xmlData.substring(startIndex, i),
              i: closeIndex
            };
          }
        }
        i = closeIndex;
      } else if (c1 === 63) {
        const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.");
        i = closeIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 45 && xmlData.charCodeAt(i + 3) === 45) {
        const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.");
        i = closeIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 91) {
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
        i = closeIndex;
      } else {
        const tagData = readTagExp(xmlData, i, ">");
        if (tagData) {
          const openTagName = tagData && tagData.tagName;
          if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
            openTagCount++;
          }
          i = tagData.closeIndex;
        }
      }
    }
  }
}
function parseValue(val, shouldParse, options) {
  if (shouldParse && typeof val === "string") {
    const newval = val.trim();
    if (newval === "true") return true;
    else if (newval === "false") return false;
    else return toNumber(val, options);
  } else {
    if (isExist(val)) {
      return val;
    } else {
      return "";
    }
  }
}
function transformTagName(fn, tagName, tagExp, options) {
  if (fn) {
    const newTagName = fn(tagName);
    if (tagExp === tagName) {
      tagExp = newTagName;
    }
    tagName = newTagName;
  }
  tagName = sanitizeName(tagName, options);
  return { tagName, tagExp };
}
function sanitizeName(name, options) {
  if (criticalProperties.includes(name)) {
    throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
  } else if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
    return options.onDangerousProperty(name);
  }
  return name;
}

// ../verify/node_modules/fast-xml-parser/src/xmlparser/node2json.js
var METADATA_SYMBOL2 = XmlNode.getMetaDataSymbol();
function stripAttributePrefix(attrs, prefix) {
  if (!attrs || typeof attrs !== "object") return {};
  if (!prefix) return attrs;
  const rawAttrs = {};
  for (const key in attrs) {
    if (key.startsWith(prefix)) {
      const rawName = key.substring(prefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}
function prettify(node, options, matcher, readonlyMatcher) {
  return compress(node, options, matcher, readonlyMatcher);
}
function compress(arr, options, matcher, readonlyMatcher) {
  let text;
  const compressedObj = {};
  for (let i = 0; i < arr.length; i++) {
    const tagObj = arr[i];
    const property = propName(tagObj);
    if (property !== void 0 && property !== options.textNodeName) {
      const rawAttrs = stripAttributePrefix(
        tagObj[":@"] || {},
        options.attributeNamePrefix
      );
      matcher.push(property, rawAttrs);
    }
    if (property === options.textNodeName) {
      if (text === void 0) text = tagObj[property];
      else text += "" + tagObj[property];
    } else if (property === void 0) {
      continue;
    } else if (tagObj[property]) {
      let val = compress(tagObj[property], options, matcher, readonlyMatcher);
      const isLeaf = isLeafTag(val, options);
      if (tagObj[":@"]) {
        assignAttributes(val, tagObj[":@"], readonlyMatcher, options);
      } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
        val = val[options.textNodeName];
      } else if (Object.keys(val).length === 0) {
        if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
        else val = "";
      }
      if (tagObj[METADATA_SYMBOL2] !== void 0 && typeof val === "object" && val !== null) {
        val[METADATA_SYMBOL2] = tagObj[METADATA_SYMBOL2];
      }
      if (compressedObj[property] !== void 0 && Object.prototype.hasOwnProperty.call(compressedObj, property)) {
        if (!Array.isArray(compressedObj[property])) {
          compressedObj[property] = [compressedObj[property]];
        }
        compressedObj[property].push(val);
      } else {
        const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() : readonlyMatcher;
        if (options.isArray(property, jPathOrMatcher, isLeaf)) {
          compressedObj[property] = [val];
        } else {
          compressedObj[property] = val;
        }
      }
      if (property !== void 0 && property !== options.textNodeName) {
        matcher.pop();
      }
    }
  }
  if (typeof text === "string") {
    if (text.length > 0) compressedObj[options.textNodeName] = text;
  } else if (text !== void 0) compressedObj[options.textNodeName] = text;
  return compressedObj;
}
function propName(obj) {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key !== ":@") return key;
  }
}
function assignAttributes(obj, attrMap, readonlyMatcher, options) {
  if (attrMap) {
    const keys = Object.keys(attrMap);
    const len = keys.length;
    for (let i = 0; i < len; i++) {
      const atrrName = keys[i];
      const rawAttrName = atrrName.startsWith(options.attributeNamePrefix) ? atrrName.substring(options.attributeNamePrefix.length) : atrrName;
      const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() + "." + rawAttrName : readonlyMatcher;
      if (options.isArray(atrrName, jPathOrMatcher, true, true)) {
        obj[atrrName] = [attrMap[atrrName]];
      } else {
        obj[atrrName] = attrMap[atrrName];
      }
    }
  }
}
function isLeafTag(obj, options) {
  const { textNodeName } = options;
  const propCount = Object.keys(obj).length;
  if (propCount === 0) {
    return true;
  }
  if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
    return true;
  }
  return false;
}

// ../verify/node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var XMLParser = class {
  constructor(options) {
    this.externalEntities = {};
    this.options = buildOptions(options);
  }
  /**
   * Parse XML dats to JS object 
   * @param {string|Uint8Array} xmlData 
   * @param {boolean|Object} validationOption 
   */
  parse(xmlData, validationOption) {
    if (typeof xmlData !== "string" && xmlData.toString) {
      xmlData = xmlData.toString();
    } else if (typeof xmlData !== "string") {
      throw new Error("XML data is accepted in String or Bytes[] form.");
    }
    if (validationOption) {
      if (validationOption === true) validationOption = {};
      const result = validate(xmlData, validationOption);
      if (result !== true) {
        throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
      }
    }
    const orderedObjParser = new OrderedObjParser(this.options);
    orderedObjParser.entityDecoder.setExternalEntities(this.externalEntities);
    const orderedResult = orderedObjParser.parseXml(xmlData);
    if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
    else return prettify(orderedResult, this.options, orderedObjParser.matcher, orderedObjParser.readonlyMatcher);
  }
  /**
   * Add Entity which is not by default supported by this library
   * @param {string} key 
   * @param {string} value 
   */
  addEntity(key, value) {
    if (value.indexOf("&") !== -1) {
      throw new Error("Entity value can't have '&'");
    } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
      throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
    } else if (value === "&") {
      throw new Error("An entity with value '&' is not permitted");
    } else {
      this.externalEntities[key] = value;
    }
  }
  /**
   * Returns a Symbol that can be used to access the metadata
   * property on a node.
   * 
   * If Symbol is not available in the environment, an ordinary property is used
   * and the name of the property is here returned.
   * 
   * The XMLMetaData property is only present when `captureMetaData`
   * is true in the options.
   */
  static getMetaDataSymbol() {
    return XmlNode.getMetaDataSymbol();
  }
};

// lib/canonical-model.ts
var provenance = (seed, sourceField) => [{ ...seed, sourceField }];
function knownValue(published, normalized2, seed, sourceField) {
  return { status: "known", published, normalized: normalized2, provenance: provenance(seed, sourceField) };
}
function derivedValue(normalized2, seed, rule) {
  return { status: "known", published: null, normalized: normalized2, provenance: provenance(seed, `VIGIA:${rule}`) };
}
function missingValue(status = "not_published") {
  return { status, published: null, normalized: null, provenance: [] };
}
var sourceScopedId = (source, sourceRecordId) => `${source === "SAFETY GATE" ? "sg" : source.toLowerCase()}:${sourceRecordId.trim()}`;
async function hashPayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
var comparableCanonical = (alert) => ({
  identity: alert.identity,
  headline: alert.headline,
  dates: { publishedAt: alert.dates.publishedAt, officialUpdatedAt: null },
  lifecycle: alert.lifecycle,
  product: alert.product,
  operators: alert.operators,
  geography: alert.geography,
  risk: alert.risk,
  resources: alert.resources
});
async function canonicalContentHash(alert) {
  return hashPayload(comparableCanonical(alert));
}

// lib/recurrence.ts
var normalizeEntityKey = (value = "") => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\b(?:s\.?l\.?u?|s\.?a\.?u?|s\.?c\.?|sociedad limitada|sociedad anonima)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

// lib/oecd-published.ts
var record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
var stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue).sort((left, right) => {
    const a = JSON.stringify(left);
    const b = JSON.stringify(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stableValue(child)]));
  return value;
};
var detail = (canonical2) => record(canonical2.sourceRecord.detail);
var MATERIAL_DETAIL_FIELDS = [
  "uri",
  "id",
  "language",
  "languageId",
  "countryId",
  "countryName",
  "date",
  "extUrl",
  "product.name",
  "product.desc",
  "product.type",
  "product.modelAndVolume",
  "product.code",
  "gtin",
  "gtin.desc",
  "gtin.product.type",
  "hts",
  "hts.desc",
  "hts.product.type",
  "manufacturer.country",
  "manufacturer.name",
  "manufacturer.url",
  "distributor.name",
  "distributor.website",
  "hazard",
  "riskLevel",
  "injuries",
  "action",
  "units",
  "images",
  "tags"
];
var oecdOfficialSourceProjection = (canonical2) => {
  if (canonical2.identity.source !== "OECD") return null;
  const raw = detail(canonical2);
  if (!raw) return null;
  return stableValue(Object.fromEntries(MATERIAL_DETAIL_FIELDS.flatMap((key) => key in raw ? [[key, raw[key]]] : [])));
};
var oecdOfficialSourceFingerprint = (canonical2) => {
  const projection = oecdOfficialSourceProjection(canonical2);
  return projection === null ? null : JSON.stringify(projection);
};
var sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
async function oecdContentHash(canonical2) {
  const canonicalHash = await canonicalContentHash(canonical2);
  return sha256(JSON.stringify({ canonicalHash, official: oecdOfficialSourceProjection(canonical2) }));
}

// lib/oecd.ts
var OECD_PUBLIC_BASE = "https://globalrecalls.oecd.org/";
var OECD_API_BASE = `${OECD_PUBLIC_BASE}ws`;
var OECD_SEARCH_ENDPOINT = `${OECD_API_BASE}/search.xqy`;
var OECD_DETAIL_ENDPOINT = `${OECD_API_BASE}/getrecall.xqy`;
var OECD_DOCUMENT_ENDPOINT = `${OECD_API_BASE}/getdocument.xqy`;
var OECD_EXPORT_ENDPOINT = `${OECD_API_BASE}/export.xqy`;
var OECD_RSS_ENDPOINT = `${OECD_API_BASE}/rss.xqy`;
var OECD_URI_PREFIX = "http://PoliciesApplications.oecd.org/GlobalRecalls/Recall/";
var RSS_WINDOW_MS = 7 * 24 * 60 * 6e4;
var INVALID_SENTINEL_DATE = "1900-01-01";
var OecdRequestError = class extends Error {
  constructor(message, kind, status = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.name = "OecdRequestError";
  }
};
var xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false
});
var defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var retryableStatus = (status) => status === 408 || status === 425 || status === 429 || status >= 500;
var stringValue = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && !Array.isArray(value)) return stringValue(value["#text"]);
  return "";
};
var arrayValue = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
var recordValue = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var uniqueStrings = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
var parseOecdPortalTime = (value) => {
  const normalized2 = /^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:$/u.test(value.trim()) ? `${value.trim()}00 GMT` : value;
  const milliseconds = Date.parse(normalized2);
  return Number.isFinite(milliseconds) ? milliseconds : null;
};
var retryDelay = (response2, attempt) => {
  const header = response2?.headers.get("Retry-After")?.trim() ?? "";
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1e3, 3e4);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), 3e4);
  return 500 * (attempt + 1);
};
async function requestText(url, accept, client = {}) {
  const fetchImpl = client.fetchImpl ?? fetch;
  const sleep = client.sleep ?? defaultSleep;
  const retries = Math.max(0, Math.min(4, client.retries ?? 2));
  const timeoutMs = Math.max(1e3, client.timeoutMs ?? 9e4);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response2 = null;
    try {
      response2 = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Accept": accept }
      });
      if (!response2.ok) {
        const error = new OecdRequestError(`OECD respondi\xF3 con estado ${response2.status}`, "http", response2.status);
        if (!retryableStatus(response2.status) || attempt === retries) throw error;
        lastError = error;
        await sleep(retryDelay(response2, attempt));
        continue;
      }
      return await response2.text();
    } catch (error) {
      if (error instanceof OecdRequestError && !retryableStatus(error.status ?? 0)) throw error;
      lastError = error;
      if (attempt === retries) {
        const timeout = error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`);
        throw error instanceof OecdRequestError ? error : new OecdRequestError(
          timeout ? "OECD agot\xF3 el tiempo de respuesta" : "No se pudo conectar con OECD",
          timeout ? "timeout" : "network"
        );
      }
      await sleep(retryDelay(response2, attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new OecdRequestError("OECD no respondi\xF3", "network");
}
async function requestJson(url, client = {}) {
  const text = await requestText(url, "application/json", client);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new OecdRequestError(`OECD devolvi\xF3 JSON inv\xE1lido: ${error instanceof Error ? error.message : "respuesta ilegible"}`, "invalid-response");
  }
}
var decodeEntities = (value) => value.replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)));
var normalizeOecdText = (value) => decodeEntities(value).replace(/<br\s*\/?\s*>/giu, " \xB7 ").replace(/<\/p\s*>/giu, " ").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
function parseOecdUri(value) {
  if (!value.startsWith(OECD_URI_PREFIX)) return null;
  const tail = value.slice(OECD_URI_PREFIX.length);
  const [languageId, countryId, ...idParts] = tail.split("/");
  const encodedId = idParts.join("/");
  let id = encodedId;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
  }
  if (!languageId || !countryId || !id || idParts.some((part) => !part)) return null;
  return { languageId: languageId.toUpperCase(), countryId: countryId.toUpperCase(), id };
}
var oecdUri = (languageId, countryId, id) => `${OECD_URI_PREFIX}${languageId.toUpperCase()}/${countryId.toUpperCase()}/${encodeURIComponent(id.trim())}`;
var oecdReference = (uri) => {
  const parsed = parseOecdUri(uri);
  return parsed ? `${parsed.languageId}/${parsed.countryId}/${parsed.id}` : "";
};
var oecdOfficialUrl = (uri) => `${OECD_PUBLIC_BASE}#/recalls/${encodeURIComponent(uri)}`;
var oecdDocumentUrl = (uri) => `${OECD_DOCUMENT_ENDPOINT}?${new URLSearchParams({ uri }).toString()}`;
var parseProductCodes = (value) => arrayValue(value).map(recordValue).flatMap((raw) => {
  const code = stringValue(raw.code);
  if (!code) return [];
  return [{
    code,
    description: stringValue(raw.desc),
    type: stringValue(raw.type).toLowerCase(),
    taxonomyVersion: stringValue(raw.GPC)
  }];
}).filter((entry, index, all) => all.findIndex((candidate) => candidate.code === entry.code && candidate.type === entry.type && candidate.description === entry.description && candidate.taxonomyVersion === entry.taxonomyVersion) === index).sort((left, right) => `${left.type}:${left.code}:${left.description}`.localeCompare(`${right.type}:${right.code}:${right.description}`, "en"));
var parseCountries = (value) => arrayValue(value).map(recordValue).flatMap((raw) => {
  const id = stringValue(raw.id).toUpperCase();
  const name = stringValue(raw.name);
  return id || name ? [{ id, name }] : [];
}).filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id && candidate.name === entry.name) === index).sort((left, right) => `${left.id}:${left.name}`.localeCompare(`${right.id}:${right.name}`, "en"));
var parseImages = (value) => arrayValue(value).map(recordValue).flatMap((raw) => {
  const uri = stringValue(raw.imageUri);
  return uri ? [{ uri, alt: stringValue(raw["alt.text"]), mediaType: stringValue(raw["media.type"]) }] : [];
}).filter((entry, index, all) => all.findIndex((candidate) => candidate.uri === entry.uri) === index).sort((left, right) => left.uri.localeCompare(right.uri, "en"));
var parsePublishedCodes = (value) => uniqueStrings(arrayValue(value).flatMap((candidate) => {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const row2 = candidate;
    return [stringValue(row2.code), stringValue(row2["#text"])];
  }
  return [stringValue(candidate)];
}));
function parseOecdDetail(payload) {
  const root2 = recordValue(payload);
  const raw = recordValue(root2.recall);
  const uri = stringValue(raw.uri);
  const identity = parseOecdUri(uri);
  const productName = stringValue(raw["product.name"]);
  if (!identity || !productName) throw new OecdRequestError("OECD devolvi\xF3 un detalle sin identidad o producto", "data-missing");
  return {
    uri: oecdUri(identity.languageId, identity.countryId, identity.id),
    id: stringValue(raw.id) || identity.id,
    languageId: (stringValue(raw.languageId) || identity.languageId).toUpperCase(),
    languageName: stringValue(raw.language),
    countryId: (stringValue(raw.countryId) || identity.countryId).toUpperCase(),
    countryName: stringValue(raw.countryName),
    publishedDate: stringValue(raw.date),
    externalUrl: stringValue(raw.extUrl),
    productName,
    productDescription: stringValue(raw["product.desc"]),
    productType: stringValue(raw["product.type"]),
    productModelAndVolume: stringValue(raw["product.modelAndVolume"]),
    productCodes: parseProductCodes(raw["product.code"]),
    manufacturerCountries: parseCountries(raw["manufacturer.country"]),
    manufacturerName: stringValue(raw["manufacturer.name"]),
    manufacturerUrl: stringValue(raw["manufacturer.url"]),
    distributorName: stringValue(raw["distributor.name"]),
    distributorUrl: stringValue(raw["distributor.website"]),
    gtin: parsePublishedCodes(raw.gtin),
    hts: parsePublishedCodes(raw.hts),
    hazard: stringValue(raw.hazard),
    action: stringValue(raw.action),
    injuries: stringValue(raw.injuries),
    riskLevel: stringValue(raw.riskLevel),
    units: stringValue(raw.units),
    images: parseImages(raw.images),
    raw
  };
}
async function fetchOecdDetail(uri, client = {}) {
  const query = new URLSearchParams({ uri, uiLang: "en" });
  return parseOecdDetail(await requestJson(`${OECD_DETAIL_ENDPOINT}?${query.toString()}`, client));
}
var validExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
function classifyOecdDomain(productCodes) {
  const segment = productCodes.find((entry) => entry.type === "segment");
  const family = productCodes.find((entry) => entry.type === "family");
  if (!segment) return { normalized: "Sin clasificar", canonical: "Sin clasificar", rule: "missing-gpc-segment" };
  if (segment.code !== "50000000") return { normalized: "No alimentaria", canonical: "No alimentaci\xF3n", rule: "gpc-non-food-segment" };
  if (family?.code === "50210000" || /tobacco|cannabis|smoking/iu.test(family?.description ?? "")) {
    return { normalized: "No alimentaria", canonical: "No alimentaci\xF3n", rule: "gpc-tobacco-family" };
  }
  if (family) return { normalized: "Alimentaria", canonical: "Alimentaria", rule: "gpc-food-family" };
  return { normalized: "Sin clasificar", canonical: "Sin clasificar", rule: "ambiguous-food-beverage-tobacco-segment" };
}
var priorityFrom = (riskLevel) => /critical|serious|high|grave|sérieux/iu.test(riskLevel) ? "Alta" : "Media";
async function normalizeOecdDetail(detail3, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), context = {}) {
  const reference = oecdReference(detail3.uri);
  if (!reference) throw new OecdRequestError("El detalle OECD no permite construir una identidad estable", "data-missing");
  const officialUrl = oecdOfficialUrl(detail3.uri);
  const id = sourceScopedId("OECD", reference);
  const seed = { source: "OECD", sourceRecordId: reference, officialUrl };
  const productName = normalizeOecdText(detail3.productName);
  if (!productName) throw new OecdRequestError(`El registro OECD ${reference} no contiene nombre de producto`, "data-missing");
  const productDescription = normalizeOecdText(detail3.productDescription);
  const hazard = normalizeOecdText(detail3.hazard);
  const action = normalizeOecdText(detail3.action);
  const model = normalizeOecdText(detail3.productModelAndVolume);
  const categoryCode = detail3.productCodes.find((entry) => entry.type === "brick") ?? detail3.productCodes.find((entry) => entry.type === "class") ?? detail3.productCodes.find((entry) => entry.type === "family") ?? detail3.productCodes.find((entry) => entry.type === "segment");
  const category = categoryCode?.description || normalizeOecdText(detail3.productType);
  const domain = classifyOecdDomain(detail3.productCodes);
  const originCountries = uniqueStrings(detail3.manufacturerCountries.map((country) => country.name || country.id));
  const publication = detail3.publishedDate === INVALID_SENTINEL_DATE ? "" : detail3.publishedDate;
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/u.test(publication) ? `${publication}T00:00:00.000Z` : "";
  const portalCreatedAt = context.exportRecord?.portalCreatedAt || context.rssItem?.portalPublishedAt || "";
  const portalCreatedMs = parseOecdPortalTime(portalCreatedAt);
  const portalCreatedIso = portalCreatedMs === null ? "" : new Date(portalCreatedMs).toISOString();
  const operators = [
    ...detail3.manufacturerName ? [{
      role: "manufacturer",
      name: knownValue(detail3.manufacturerName, normalizeOecdText(detail3.manufacturerName), seed, "manufacturer.name"),
      evidence: "manufacturer.name"
    }] : [],
    ...detail3.distributorName ? [{
      role: "distributor",
      name: knownValue(detail3.distributorName, normalizeOecdText(detail3.distributorName), seed, "distributor.name"),
      evidence: "distributor.name"
    }] : []
  ].filter((operator, index, all) => all.findIndex((candidate) => candidate.role === operator.role && candidate.name.normalized?.toLocaleLowerCase("en") === operator.name.normalized?.toLocaleLowerCase("en")) === index);
  const identifiers = [
    ...detail3.gtin.map((value) => ({ kind: "ean", value, published: value })),
    ...detail3.hts.map((value) => ({ kind: "other", value, published: value }))
  ];
  const resources = [
    { kind: "official_page", url: officialUrl, label: "Ficha oficial OECD" },
    ...validExternalUrl(detail3.externalUrl) ? [{ kind: "official_page", url: detail3.externalUrl, label: "Autoridad de origen publicada por OECD" }] : [],
    ...validExternalUrl(detail3.manufacturerUrl) ? [{ kind: "other", url: detail3.manufacturerUrl, label: "Sitio web del fabricante publicado por OECD" }] : [],
    ...validExternalUrl(detail3.distributorUrl) ? [{ kind: "other", url: detail3.distributorUrl, label: "Sitio web del distribuidor publicado por OECD" }] : [],
    ...detail3.images.map((image) => ({ kind: "image", url: oecdDocumentUrl(image.uri), label: image.alt || "Imagen oficial OECD" }))
  ].filter((resource, index, all) => all.findIndex((candidate) => candidate.kind === resource.kind && candidate.url === resource.url) === index);
  const priority = priorityFrom(detail3.riskLevel);
  const canonical2 = {
    identity: { internalId: id, source: "OECD", sourceRecordId: reference, officialReference: reference, officialUrl },
    headline: knownValue(detail3.productName, productName, seed, "product.name"),
    dates: {
      publishedAt: publishedAt ? knownValue(detail3.publishedDate, publishedAt, seed, "date") : missingValue(detail3.publishedDate === INVALID_SENTINEL_DATE ? "unknown" : "not_published"),
      detectedAt,
      officialUpdatedAt: missingValue("not_published")
    },
    lifecycle: { officialUpdate: missingValue("unknown") },
    product: {
      name: knownValue(detail3.productName, productName, seed, "product.name"),
      category: category ? knownValue(categoryCode?.description || detail3.productType, category, seed, categoryCode ? `product.code:${categoryCode.type}` : "product.type") : missingValue(),
      domain: domain.canonical,
      model: model ? knownValue(detail3.productModelAndVolume, model, seed, "product.modelAndVolume") : missingValue(),
      commercialReference: missingValue(),
      lots: missingValue(),
      identifiers
    },
    operators,
    geography: {
      originCountry: originCountries.length ? knownValue(originCountries.join(" | "), originCountries.join(" \xB7 "), seed, "manufacturer.country") : missingValue(),
      notifyingCountry: missingValue("not_published"),
      affectedTerritories: detail3.countryName ? knownValue([detail3.countryName], [detail3.countryName], seed, "countryName:economy-of-recall") : missingValue(),
      distribution: missingValue()
    },
    risk: {
      type: detail3.riskLevel ? knownValue([detail3.riskLevel], [normalizeOecdText(detail3.riskLevel)], seed, "riskLevel") : missingValue(),
      hazard: hazard ? knownValue(detail3.hazard, hazard, seed, "hazard") : missingValue(),
      description: hazard ? knownValue(detail3.hazard, hazard, seed, "hazard") : missingValue(),
      reason: missingValue(),
      measures: missingValue(),
      recommendations: action ? knownValue(detail3.action, action, seed, "action") : missingValue(),
      priority: detail3.riskLevel ? knownValue(detail3.riskLevel, priority, seed, "riskLevel") : derivedValue(priority, seed, "neutral-priority-without-oecd-risk-level")
    },
    resources,
    sourceRecord: {
      detailLevel: "detail",
      mechanisms: [
        ...context.exportRecord ? ["export"] : [],
        ...context.searchRecord ? ["search"] : [],
        ...context.rssItem ? ["rss"] : [],
        "detail"
      ],
      reference,
      uri: detail3.uri,
      portalCreatedAt: portalCreatedIso || null,
      domainNormalization: domain,
      ...productDescription ? { productDescriptionNormalized: productDescription } : {},
      detail: detail3.raw,
      ...context.exportRecord ? { export: context.exportRecord.raw } : {},
      ...context.searchRecord ? { search: context.searchRecord.raw } : {},
      ...context.rssItem ? { rss: context.rssItem.raw } : {}
    }
  };
  const contentHash = await oecdContentHash(canonical2);
  const provider = operators.find((operator) => operator.role === "manufacturer") ?? operators[0];
  return {
    id,
    reference,
    source: "OECD",
    type: domain.normalized,
    priority,
    title: productName,
    product: productName,
    brand: "",
    productClass: category || "Sin clasificar",
    productKey: normalizeEntityKey(productName),
    brandKey: "",
    provider: provider?.name.normalized ?? "",
    providerKey: normalizeEntityKey(provider?.name.normalized ?? ""),
    providerRole: provider?.role === "manufacturer" ? "Fabricante" : provider?.role === "distributor" ? "Distribuidor" : "",
    providerEvidence: provider?.evidence ?? "",
    hazard: hazard || "Consultar la ficha oficial OECD",
    origin: originCountries.join(" \xB7 ") || "No indicado",
    scope: detail3.countryName ? `Retirada en ${detail3.countryName}` : "OECD Global Recalls",
    action: action || "Consultar la ficha oficial OECD",
    lots: [],
    imageUrl: resources.find((resource) => resource.kind === "image")?.url ?? null,
    url: officialUrl,
    publishedAt: publishedAt || null,
    detectedAt,
    updatedAt: detectedAt,
    contentHash,
    versionCount: 1,
    isUpdate: false,
    canonical: canonical2
  };
}

// ops/sr271-oecd27022-read.ts
var root = "https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f";
var database = "55596003-1b90-4f66-aad8-decb21205f13";
if (Number(process.env.RUN_ATTEMPT) !== 1 || Date.now() > Date.parse("2026-10-09T11:35:00Z")) throw Error("OECD identity read expired");
var sql = "SELECT a.id,a.reference,a.content_hash,a.version_count,a.published_at,a.updated_at,a.detected_at,a.canonical_json,i.source_record_id FROM alerts AS a JOIN alert_source_identities AS i ON i.alert_id=a.id WHERE a.source='OECD' AND a.reference='EN/US/27022'";
var response = await fetch(root + "/d1/database/" + database + "/query", { method: "POST", headers: { Authorization: "Bearer " + process.env.CF_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ sql }), signal: AbortSignal.timeout(25e3) });
var p = await response.json();
if (!response.ok || !p.success || p.result.some((x) => !x.success || x.meta.rows_written || x.meta.changes || x.meta.served_by_primary !== true) || p.result[0].results.length !== 1) throw Error("Primary OECD identity SELECT failed");
var row = p.result[0].results[0];
var canonical = JSON.parse(row.canonical_json);
var requests = 0;
var officialFetch = async (input, options) => {
  const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (u.origin !== "https://globalrecalls.oecd.org" || u.pathname !== "/ws/getrecall.xqy" || u.searchParams.get("uri") !== oecdUri("EN", "US", "27022") || (options?.method ?? "GET") !== "GET") throw Error("Exact official GET allowlist");
  requests++;
  return fetch(input, { ...options, signal: AbortSignal.timeout(3e4) });
};
var detail2 = await fetchOecdDetail(oecdUri("EN", "US", "27022"), { fetchImpl: officialFetch, retries: 0 });
var normalized = await normalizeOecdDetail(detail2, row.detected_at);
var materialParity = oecdOfficialSourceFingerprint(canonical) === oecdOfficialSourceFingerprint(normalized.canonical);
var identityParity = normalized.id === row.id && normalized.reference === row.reference && normalized.canonical.identity.sourceRecordId === row.source_record_id;
var hashParity = normalized.contentHash === row.content_hash;
console.log("SR271_OECD_27022_OFFICIAL_READ " + JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString(), zeroWrite: true, primarySnapshot: true, requests, reference: row.reference, id: row.id, sourceRecordId: row.source_record_id, storedHash: row.content_hash, officialHash: normalized.contentHash, versionCount: row.version_count, publishedAt: row.published_at, officialPublishedAt: normalized.publishedAt, storedUpdatedAt: row.updated_at, identityParity, materialParity, hashParity, officialUri: detail2.uri, officialDate: detail2.publishedDate, classification: normalized.type }));
if (requests !== 1 || !identityParity || !materialParity || !hashParity || normalized.publishedAt !== row.published_at) process.exitCode = 1;
