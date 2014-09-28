// Copyright 2014 Volker Sorge
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Utility functions for mathspeak rules.
 * @author volker.sorge@gmail.com (Volker Sorge)
 */

goog.provide('sre.MathspeakUtil');

goog.require('sre.SemanticTree.Node');
goog.require('sre.SystemExternal');


/**
 * String function to separate text into single characters by adding
 * intermittent spaces.
 * @param {!Node} node The node to be processed.
 * @return {string} The spaced out text.
 */
sre.MathspeakUtil.spaceoutText = function(node) {
  return node.textContent.split('').join(' ');
};


/**
 * Query function that splits into number nodes and content nodes.
 * @param {!Node} node The node to be processed.
 * @return {Array.<Node>} List of number and content nodes.
 */
sre.MathspeakUtil.spaceoutNumber = function(node) {
  var content = node.textContent.split('');
  var result = [];
  var dp = new sre.SystemExternal.xmldom.DOMParser();
  for (var i = 0, chr; chr = content[i]; i++) {
    // We ignore Greek characters for now!
    var type = sre.SemanticAttr.Type.NUMBER;
    var role = chr.match(/\W/) ?
        sre.SemanticAttr.Role.UNKNOWN :
        sre.SemanticAttr.Role.PROTECTED;
    var doc = dp.parseFromString('<' + type + ' role="' + role + '">' +
                                 chr + '</' + type + '>');
    result.push(doc.documentElement);
  }
  return result;
};


/**
 * Tags that serve as a nesting barrier by default.
 * @type {Array.<sre.SemanticAttr.Type>}
 */
sre.MathspeakUtil.nestingBarriers = [
  sre.SemanticAttr.Type.SQRT,
  sre.SemanticAttr.Type.ROOT,
  sre.SemanticAttr.Type.INTEGRAL,
  sre.SemanticAttr.Type.SUBSCRIPT,
  sre.SemanticAttr.Type.SUPERSCRIPT,
  sre.SemanticAttr.Type.TABLE,
  sre.SemanticAttr.Type.MULTILINE,
  sre.SemanticAttr.Type.MATRIX,
  sre.SemanticAttr.Type.VECTOR,
  sre.SemanticAttr.Type.CASES,
  sre.SemanticAttr.Type.ROW,
  sre.SemanticAttr.Type.LINE,
  sre.SemanticAttr.Type.CELL
];


/**
 * Dictionary to store the nesting depth of each node.
 * @type {Object.<string, Object.<Node, number>>}
 */
sre.MathspeakUtil.nestingDepth = {};


/**
 * Computes the depth of nested descendants of a particular set of tags for a
 * node.
 * @param {string} type The type of nesting depth.
 * @param {!Node} node The XML node to check.
 * @param {Array.<string>} tags The tags to be considered for the nesting depth.
 * @param {Array.<string>=} opt_barrierTags Optional list of tags that serve as
 *     barrier.
 * @param {Object.<string, string>=} opt_barrierAttrs Attribute value pairs that
 *     serve as barrier.
 * @param {function(!Node): boolean=} opt_func A function that overrides both
 *     tags and attribute barriers, i.e., if function returns true it will be
 *     considered as barrier, otherwise tags and attributes will be considered.
 * @return {!number} The nesting depth.
 */
sre.MathspeakUtil.getNestingDepth = function(type, node, tags, opt_barrierTags,
                                             opt_barrierAttrs, opt_func) {
  opt_barrierTags = opt_barrierTags || sre.MathspeakUtil.nestingBarriers;
  opt_barrierAttrs = opt_barrierAttrs || {};
  opt_func = opt_func || function(node) { return false; };
  if (!sre.MathspeakUtil.nestingDepth[type]) {
    sre.MathspeakUtil.nestingDepth[type] = {};
  }
  if (sre.MathspeakUtil.nestingDepth[type][node]) {
    return sre.MathspeakUtil.nestingDepth[type][node];
  }
  if (opt_func(node) || tags.indexOf(node.tagName) < 0) {
    return 0;
  }
  var depth = sre.MathspeakUtil.computeNestingDepth_(
      node, tags, sre.MathUtil.setdifference(opt_barrierTags, tags),
      opt_barrierAttrs, opt_func, 0);
  sre.MathspeakUtil.nestingDepth[type][node] = depth;
  return depth;
};


/**
 * Checks if a node contains given attribute value pairs.
 * @param {!Node} node The XML node to check.
 * @param {Object.<string, string>} attrs Attribute value pairs.
 * @return {boolean} True if all attributes are contained and have the given
 *     values.
 */
sre.MathspeakUtil.containsAttr = function(node, attrs) {
  if (!node.attributes) {
    return false;
  }
  var attributes = sre.DomUtil.toArray(node.attributes);
  for (var i = 0, attr; attr = attributes[i]; i++) {
    if (attrs[attr.nodeName] === attr.nodeValue) {
      return true;
    }
  }
  return false;
};


/**
 * Computes the depth of nested descendants of a particular set of tags for a
 * node recursively.
 * @param {!Node} node The XML node to process.
 * @param {Array.<string>} tags The tags to be considered for the nesting depth.
 * @param {Array.<string>} barriers List of tags that serve as barrier.
 * @param {Object.<string, string>} attrs Attribute value pairs that serve as
 *     barrier.
 * @param {function(!Node): boolean} func A function that overrides both tags
 *     and attribute barriers, i.e., if function returns true it will be
 *     considered as barrier, otherwise tags and attributes will be considered.
 * @param {number} depth Accumulator for the nesting depth that is computed.
 * @return {number} The nesting depth.
 * @private
 */
sre.MathspeakUtil.computeNestingDepth_ = function(
    node, tags, barriers, attrs, func, depth) {
  if (func(node) ||
      barriers.indexOf(node.tagName) > -1 ||
      sre.MathspeakUtil.containsAttr(node, attrs))
  {
    return depth;
  }
  if (tags.indexOf(node.tagName) > -1) {
    depth++;
  }
  if (!node.childNodes) {
    return depth;
  }
  var children = sre.DomUtil.toArray(node.childNodes);
  return Math.max.apply(null, children.map(
      function(subNode) {
        return sre.MathspeakUtil.computeNestingDepth_(
            subNode, tags, barriers, attrs, func, depth);
      }));
};


// TODO (sorge) Refactor the following to functions wrt. style attribute.
/**
 * Computes and returns the nesting depth of fraction nodes.
 * @param {!Node} node The fraction node.
 * @return {!number} The nesting depth. 0 if the node is not a fraction.
 */
sre.MathspeakUtil.fractionNestingDepth = function(node) {
  return sre.MathspeakUtil.getNestingDepth(
      'fraction', node, ['fraction'], sre.MathspeakUtil.nestingBarriers, [],
      function(node) {
        return sre.MathspeakUtil.vulgarFractionSmall(node);
      }
  );
};


/**
 * Opening string for fractions in Mathspeak verbose mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The opening string.
 */
sre.MathspeakUtil.openingFractionVerbose = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  return new Array(depth + 1).join('Start') + 'Fraction';
};


/**
 * Closing string for fractions in Mathspeak verbose mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The closing string.
 */
sre.MathspeakUtil.closingFractionVerbose = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  return new Array(depth + 1).join('End') + 'Fraction';
};


/**
 * Middle string for fractions in Mathspeak verbose mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The middle string.
 */
sre.MathspeakUtil.overFractionVerbose = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  return new Array(depth + 1).join('Over');
};


/**
 * Opening string for fractions in Mathspeak brief mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The opening string.
 */
sre.MathspeakUtil.openingFractionBrief = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  return new Array(depth + 1).join('Start') + 'Frac';
};


/**
 * Closing string for fractions in Mathspeak brief mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The closing string.
 */
sre.MathspeakUtil.closingFractionBrief = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  return new Array(depth + 1).join('End') + 'Frac';
};


/**
 * Translation for count word in superbrief nesting description.
 * @param {!number} count The counting parameter.
 * @return {!string} The corresponding string.
 */
sre.MathspeakUtil.nestingToString = function(count) {
  switch (count) {
    case 1:
      return '';
    case 2:
      return 'Twice';
    default:
      return count.toString();
  }
};


/**
 * Opening string for fractions in Mathspeak superbrief mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The opening string.
 */
sre.MathspeakUtil.openingFractionSbrief = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  if (depth === 1) {
    return 'Frac';
  }
  return 'Nest' + sre.MathspeakUtil.nestingToString(depth - 1) + 'Frac';
};


/**
 * Closing string for fractions in Mathspeak superbrief mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The closing string.
 */
sre.MathspeakUtil.closingFractionSbrief = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  if (depth === 1) {
    return 'EndFrac';
  }
  return 'Nest' + sre.MathspeakUtil.nestingToString(depth - 1) + 'EndFrac';
};


/**
 * Middle string for fractions in Mathspeak superbrief mode.
 * @param {!Node} node The fraction node.
 * @return {!string} The middle string.
 */
sre.MathspeakUtil.overFractionSbrief = function(node) {
  var depth = sre.MathspeakUtil.fractionNestingDepth(node);
  if (depth === 1) {
    return 'Over';
  }
  return 'Nest' + sre.MathspeakUtil.nestingToString(depth - 1) + 'Over';
};


/**
 * String representation of zero to nineteen.
 * @type {Array.<string>}
 */
sre.MathspeakUtil.onesNumbers = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'
];


/**
 * String representation of twenty to ninety.
 * @type {Array.<string>}
 */
sre.MathspeakUtil.tensNumbers = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty',
  'ninety'
];


/**
 * String representation of thousand to decillion.
 * @type {Array.<string>}
 */
sre.MathspeakUtil.largeNumbers = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion',
  'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion',
  'decillion'
];


/**
 * Translates a number of up to twelve digits into a string representation.
 * @param {!number} number The number to translate.
 * @return {!string} The string representation of that number.
 */
sre.MathspeakUtil.hundredsToWords = function(number) {
  var n = number % 1000;
  var str = '';
  str += sre.MathspeakUtil.onesNumbers[Math.floor(n / 100)] ?
      sre.MathspeakUtil.onesNumbers[Math.floor(n / 100)] + '-hundred' : '';
  n = n % 100;
  if (n) {
    str += str ? '-' : '';
    str += sre.MathspeakUtil.onesNumbers[n] ||
        (sre.MathspeakUtil.tensNumbers[Math.floor(n / 10)] + '-' +
        sre.MathspeakUtil.onesNumbers[n % 10]);
  }
  return str;
};


/**
 * Translates a number of up to twelve digits into a string representation.
 * @param {!number} number The number to translate.
 * @return {!string} The string representation of that number.
 */
sre.MathspeakUtil.numberToWords = function(number) {
  if (number >= Math.pow(10, 36)) {
    return number.toString();
  }
  var pos = 0;
  var str = '';
  while (number > 0) {
    var hundreds = number % 1000;
    if (hundreds) {
      str = sre.MathspeakUtil.hundredsToWords(number % 1000) +
          (pos ? '-' + sre.MathspeakUtil.largeNumbers[pos] + '-' : '') +
          str;
    }
    number = Math.floor(number / 1000);
    pos++;
  }
  return str;
};


/**
 * Translates a number of up to twelve digits into a string representation of
 * its ordinal.
 * @param {!number} num The number to translate.
 * @param {boolean} plural A flag indicating if the oridinal is in plural.
 * @return {!string} The ordinal of the number as string.
 */
sre.MathspeakUtil.numberToOrdinal = function(num, plural) {
  if (num === 2) {
    return plural ? 'halves' : 'half';
  }
  var ordinal = sre.MathspeakUtil.numberToWords(num);
  if (ordinal.match(/one$/)) {
    ordinal = ordinal.slice(0, -3) + 'first';
  } else if (ordinal.match(/two$/)) {
    ordinal = ordinal.slice(0, -3) + 'second';
  } else if (ordinal.match(/three$/)) {
    ordinal = ordinal.slice(0, -5) + 'third';
  } else if (ordinal.match(/five$/)) {
    ordinal = ordinal.slice(0, -4) + 'fifth';
  } else if (ordinal.match(/eight$/)) {
    ordinal = ordinal.slice(0, -5) + 'eighth';
  } else if (ordinal.match(/nine$/)) {
    ordinal = ordinal.slice(0, -4) + 'ninth';
  } else if (ordinal.match(/twelve$/)) {
    ordinal = ordinal.slice(0, -5) + 'twelfth';
  } else if (ordinal.match(/ty$/)) {
    ordinal = ordinal.slice(0, -2) + 'tieth';
  } else {
    ordinal = ordinal + 'th';
  }
  return plural ? ordinal + 's' : ordinal;
};


/**
 * Checks if a fraction is a convertible vulgar fraction. In this case it
 * translates enumerator and the denominator.
 * @param {!Node} node Fraction node to be translated.
 * @return {{convertible: boolean,
 *           content: (string|undefined),
 *           denominator: (number|undefined),
 *           enumerator: (number|undefined)}} If convertible denominator and
 *     enumerator are set. Otherwise only the text content is given.
 * @private
 */
sre.MathspeakUtil.convertVulgarFraction_ = function(node) {
  if (!node.childNodes || !node.childNodes[0] ||
      !node.childNodes[0].childNodes ||
      node.childNodes[0].childNodes.length < 2 ||
      node.childNodes[0].childNodes[0].tagName !==
          sre.SemanticAttr.Type.NUMBER ||
      node.childNodes[0].childNodes[1].tagName !==
          sre.SemanticAttr.Type.NUMBER
  ) {
    return {convertible: false,
      content: node.textContent};
  }
  var denStr = node.childNodes[0].childNodes[1].textContent;
  var enumStr = node.childNodes[0].childNodes[0].textContent;
  var denominator = Number(denStr);
  var enumerator = Number(enumStr);
  if (isNaN(denominator) || isNaN(enumerator)) {
    return {convertible: false,
      content: enumStr + ' Over ' + denStr};
  }
  return {convertible: true,
    enumerator: enumerator,
    denominator: denominator};
};


/**
 * Converts a vulgar fraction into string representation of enumerator and
 * denominator as ordinal.
 * @param {!Node} node Fraction node to be translated.
 * @return {!string} The string representation if it is a valid vulgar fraction.
 */
sre.MathspeakUtil.vulgarFraction = function(node) {
  var conversion = sre.MathspeakUtil.convertVulgarFraction_(node);
  if (conversion.convertible &&
      conversion.enumerator &&
      conversion.denominator) {
    return sre.MathspeakUtil.numberToWords(conversion.enumerator) + '-' +
        sre.MathspeakUtil.numberToOrdinal(conversion.denominator,
        conversion.enumerator !== 1);
  }
  return conversion.content || '';
};


/**
 * Checks if a vulgar fraction is small enough to be convertible to string in
 * MathSpeak, i.e. enumerator in [1..9] and denominator in [1..99].
 * @param {!Node} node Fraction node to be tested.
 * @return {boolean} True if it is a valid, small enough fraction.
 */
sre.MathspeakUtil.vulgarFractionSmall = function(node) {
  var conversion = sre.MathspeakUtil.convertVulgarFraction_(node);
  if (conversion.convertible) {
    var enumerator = conversion.enumerator;
    var denominator = conversion.denominator;
    return enumerator > 0 && enumerator < 10 &&
        denominator > 0 && denominator < 100;
  }
  return false;
};


/**
 * Custom query function to check if a vulgar fraction is small enough to be
 * spoken as numbers in MathSpeak.
 * @param {!Node} node Fraction node to be tested.
 * @return {!Array.<Node>} List containing the node if it is eligible. Otherwise
 *     empty.
 */
sre.MathspeakUtil.isSmallVulgarFraction = function(node) {
  return sre.MathspeakUtil.vulgarFractionSmall(node) ? [node] : [];
};


/**
 * Computes prefix for sub and superscript nodes.
 * @param {!Node} node Subscript node.
 * @param {string} init Initial prefix string.
 * @param {{sup: string, sub: string}} replace Prefix strings for sub and
 *     superscript.
 * @return {string} The complete prefix string.
 */
sre.MathspeakUtil.nestedSubSuper = function(node, init, replace) {
  while (node.parentNode) {
    node = node.parentNode;
    if (node.tagName === sre.SemanticAttr.Type.SUBSCRIPT) {
      init = replace.sub + ' ' + init;
    }
    if (node.tagName === sre.SemanticAttr.Type.SUPERSCRIPT) {
      init = replace.sup + ' ' + init;
    }
  }
  return init.trim();
};


/**
 * Computes subscript prefix in verbose mode.
 * @param {!Node} node Subscript node.
 * @return {!string} The prefix string.
 */
sre.MathspeakUtil.subscriptVerbose = function(node) {
  return sre.MathspeakUtil.nestedSubSuper(
      node, 'Subscript', {sup: 'Super', sub: 'Sub'});
};


/**
 * Computes subscript prefix in brief mode.
 * @param {!Node} node Subscript node.
 * @return {!string} The prefix string.
 */
sre.MathspeakUtil.subscriptBrief = function(node) {
  return sre.MathspeakUtil.nestedSubSuper(
      node, 'Sub', {sup: 'Sup', sub: 'Sub'});
};


/**
 * Computes subscript prefix in verbose mode.
 * @param {!Node} node Subscript node.
 * @return {!string} The prefix string.
 */
sre.MathspeakUtil.superscriptVerbose = function(node) {
  return sre.MathspeakUtil.nestedSubSuper(
      node, 'Superscript', {sup: 'Super', sub: 'Sub'});
};


/**
 * Computes subscript prefix in brief mode.
 * @param {!Node} node Subscript node.
 * @return {!string} The prefix string.
 */
sre.MathspeakUtil.superscriptBrief = function(node) {
  return sre.MathspeakUtil.nestedSubSuper(
      node, 'Sup', {sup: 'Sup', sub: 'Sub'});
};


/**
 * Computes subscript prefix in verbose mode.
 * @param {!Node} node Subscript node.
 * @return {!string} The prefix string.
 */
sre.MathspeakUtil.baselineVerbose = function(node) {
  var baseline = sre.MathspeakUtil.nestedSubSuper(
      node, '', {sup: 'Super', sub: 'Sub'});
  if (!baseline) {
    return 'Baseline';
  }
  return baseline.replace(/Sub$/, 'Subscript').
      replace(/Super$/, 'Superscript');
};


/**
 * Computes subscript prefix in brief mode.
 * @param {!Node} node Subscript node.
 * @return {!string} The prefix string.
 */
sre.MathspeakUtil.baselineBrief = function(node) {
  var baseline = sre.MathspeakUtil.nestedSubSuper(
      node, '', {sup: 'Sup', sub: 'Sub'});
  return baseline || 'Base';
};


// TODO (sorge) Refactor the following to functions wrt. style attribute.
/**
 * Computes and returns the nesting depth of radical nodes.
 * @param {!Node} node The radical node.
 * @return {!number} The nesting depth. 0 if the node is not a radical.
 */
sre.MathspeakUtil.radicalNestingDepth = function(node) {
  return sre.MathspeakUtil.getNestingDepth(
      'radical', node, ['sqrt', 'root'], sre.MathspeakUtil.nestingBarriers, []);
};


/**
 * Nested string for radicals in Mathspeak mode putting together the nesting
 * depth with a pre- and postfix string that depends on the speech style.
 * @param {!Node} node The radical node.
 * @param {!string} prefix A prefix string.
 * @param {!string} postfix A postfix string.
 * @return {!string} The opening string.
 */
sre.MathspeakUtil.nestedRadical = function(node, prefix, postfix) {
  var depth = sre.MathspeakUtil.radicalNestingDepth(node);
  if (depth === 1) {
    return postfix;
  }
  return prefix + sre.MathspeakUtil.nestingToString(depth - 1) + postfix;
};


/**
 * Opening string for radicals in Mathspeak verbose mode.
 * @param {!Node} node The radical node.
 * @return {!string} The opening string.
 */
sre.MathspeakUtil.openingRadicalVerbose = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nested', 'StartRoot');
};


/**
 * Closing string for radicals in Mathspeak verbose mode.
 * @param {!Node} node The radical node.
 * @return {!string} The closing string.
 */
sre.MathspeakUtil.closingRadicalVerbose = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nested', 'EndRoot');
};


/**
 * Middle string for radicals in Mathspeak verbose mode.
 * @param {!Node} node The radical node.
 * @return {!string} The middle string.
 */
sre.MathspeakUtil.indexRadicalVerbose = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nested', 'RootIndex');
};


/**
 * Opening string for radicals in Mathspeak brief mode.
 * @param {!Node} node The radical node.
 * @return {!string} The opening string.
 */
sre.MathspeakUtil.openingRadicalBrief = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nest', 'StartRoot');
};


/**
 * Closing string for radicals in Mathspeak brief mode.
 * @param {!Node} node The radical node.
 * @return {!string} The closing string.
 */
sre.MathspeakUtil.closingRadicalBrief = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nest', 'EndRoot');
};


/**
 * Middle string for radicals in Mathspeak superbrief mode.
 * @param {!Node} node The radical node.
 * @return {!string} The middle string.
 */
sre.MathspeakUtil.indexRadicalBrief = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nest', 'RootIndex');
};


/**
 * Opening string for radicals in Mathspeak superbrief mode.
 * @param {!Node} node The radical node.
 * @return {!string} The opening string.
 */
sre.MathspeakUtil.openingRadicalSbrief = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nest', 'Root');
};


/**
 * Middle string for radicals in Mathspeak superbrief mode.
 * @param {!Node} node The radical node.
 * @return {!string} The middle string.
 */
sre.MathspeakUtil.indexRadicalSbrief = function(node) {
  return sre.MathspeakUtil.nestedRadical(node, 'Nest', 'Index');
};

