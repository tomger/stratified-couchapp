/**
  @module  helpers
  @summary tomg's little (experimental) helpers
*/

var common = require('common');

/*
see index.html for usage and info.
TDB
*/
exports.waitForAction = function(form, actions) {
  var fns = [];
  for (var p in actions) fns.push(p);
  
  function exec(p) {
    var prefn = actions["before_"+p];
    var fn = actions[p];
    while (true) {
      if (p == "submit") {
        form.$submit(function(e) {
          e.preventDefault();
          return prefn ? prefn(e) : true;
        });
        if (false!==fn()) return;
      }
      else {
        $("." + p, form).$click(function(e) {
          e.preventDefault();
          return prefn ? prefn(e) : true;
        }).preventDefault();
        if (false!==fn()) return;
      }
    }
  };
  require("cutil").waitforFirst(exec, fns);
};

exports.createDialog = function(child_function, opts) {
  opts = opts || {};
  opts.width = opts.width || 400;
  
  var div = document.createElement("div");
  div.innerHTML = "<div class='dialog'>" 
    + (opts.title?"<h3>"+opts.title+"</h3>":"") 
    + "</div>";
  div = div.firstChild;
  document.getElementsByTagName("body")[0].appendChild(div);
  div.style.marginLeft    = -opts.width/2 + "px";
  div.style.width         = opts.width + "px";
  div.style.top           = window.scrollTop+100 + "px";
    
  var rv;
  try {
    rv = child_function(div);
  }
  finally {
    div.parentNode.removeChild(div);
  }
  return rv;
};

exports.spawnArgs = function(fn /*, args*/) {
  var args = Array.prototype.slice.call(arguments).splice(1);
  spawn(function(){
    fn.apply(this, args);
  });
};

exports.inline_template = require("mustache").to_html;

exports.template = function() {
  arguments[0] = require("http").get(arguments[0]);
  return exports.inline_template.apply(this, arguments);
};
exports.$template = function () {
  return $(exports.template.apply(this, arguments));
};

exports.createExclusiveDialog = require("cutil").makeExclusiveFunction(exports.createDialog);

exports.loadScripts = function(arrayOfScripts) {
  return require("cutil").waitforAll(require("http").script, arrayOfScripts);
};

/*
create a blocking function for each event in the list
helpers.events.click(element);
...
*/
var events = ("blur focus focusin focusout load resize scroll unload click dblclick " +
  "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
  "change select submit keydown keypress keyup error").split(" ");
exports.events = {};
for (var i = 0, event; event = events[i]; ++i) exports.events[event] = function(event) {
  return function (node) {
    return require("dom").waitforEvent(node, event);
  }
}(event);

