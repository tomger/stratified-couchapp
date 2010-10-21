/*
 * Oni Apollo 'common' module
 * Common JS utility functions 
 *
 * Part of the Oni Apollo client-side SJS library
 * @ONI_APOLLO_VERSION@
 * http://onilabs.com/apollo
 *
 * (c) 2010 Oni Labs, http://onilabs.com
 *
 * This file is licensed under the terms of the MIT License:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */
/**
  @module    common
  @summary   Common JS utility functions
*/

/**
  @function bind
  @summary Bind a function to a given 'this' object.
  @param   {Function} [f] Function to bind to *thisObj*
  @param   {Object} [thisObj] 'this' object to bind *f* to
  @return  {Function} Bound function
*/
exports.bind = function(f, thisObj) {
  return function() { return f.apply(thisObj, arguments); };
};

/**
  @function isArray
  @summary  Tests if an object is an array.
  @param    {anything} [testObj] Object to test.
  @return   {Boolean}
*/
exports.isArray = function(testObj) {
  try {
    return testObj &&
      !(testObj.propertyIsEnumerable('length')) &&
      (typeof testObj === 'object') &&
      (typeof testObj.length === 'number');
  }
  catch(e) {
    // ok, if it throws (IE does that for some objects), it is
    // definitely not an array
    return false;
  }
}

/**
  @function supplant
  @summary  Performs variable substitution on a string.
  @param    {String} [template] A string holding variable names enclosed in **{ }** braces.
  @param    {Object} [replacements] Hash of key/value pairs that will be replaced in *template*.
  @return   {String} String with placeholders replaced by variables.
  @desc
    Example:
    `var rv = common.supplant("Hello {who}", { who: "world"});
    // rv will equal "Hello world"`
*/
exports.supplant = function(str, o) {
  if (!o || !str) return str;
  return str.replace(/{([^{}]*)}/g,
    function(a, b) {
      var r = o[b];
      return r !== undefined ? r: a;
    }
  );
};

/**
  @function sanitize
  @summary  Make a string safe for insertion into html.
  @param    {String} [str] String to sanitize.
  @return   {String} Sanitized string.
  @desc
    Returns sanitized string with **<**,**>**, and **&** replaced by their corresponding html entities.
**/

var replacements = {
  '&':'&amp;',
  '>':'&gt;',
  '<':'&lt;'
};

exports.sanitize = function(str) {
  return str.replace(/[<>&]/g, function(c) {
    return replacements[c];
  })
};

/**
  @function mergeSettings
  @summary Merge objects of key/value pairs.
  @param {SETTINGSHASHES} [hashes] Object(s) with key/value pairs.
                                   See below for full syntax.
  @return {Object} Object with all key/value pairs merged.
  @desc
    *hashes* can be a simple object with key/value pairs or an arbitrarily nested
    array of (arrays of) key/value objects.

    The key/value pairs will be merged into the return object in the order that
    they appear in the arguments. I.e. settings on objects that appear later in
    *mergeSettings* arguments override settings from earlier objects.

    Full syntax for *hashes*:

        SETTINGSHASHES  : SETTINGSHASH |
                          SETTINGSHASHES, SETTINGSHASHES

        SETTINGSHASH    : undefined             |
                          [ SETTINGSHASH, ... ] |
                          { key: value, ... }
*/
exports.mergeSettings = function(/*settings-hash,...*/) {
  return accuSettings({}, arguments);
}

// helper for mergeSettings:
function accuSettings(accu /*,settings-hash,...*/) {
  for (var a=1; a<arguments.length; ++a) {
    var arg = arguments[a];
    if (exports.isArray(arg)) {
      for (var i=0; i<arg.length; ++i)
        accuSettings(accu, arg[i]);
    }
    else {
      for (var o in arg)
        accu[o] = arg[o];
    }
  }
  return accu;
}
