$.fn.extractObject = function(destination, filter) {
  var inputs = $(":input", this);
  var o = destination || {};
  $.each(inputs, function(i, el) {
    if (el.name) {
      var val;
      if ($(el).attr("type")=="checkbox") {
        val = $(el).attr("checked") ? true : false;
      } else {
        val = $(el).val();
      }
      if (filter && !filter(o, el.name, val)) return;
      o[el.name] = val;
    }
  });
  return o;
}

$.fn.fillWithObject = function(o) {
  for (var p in o) {
    var el = $(":input[name='"+p+"']", this);
    if (el.attr("type")=="checkbox") 
      el.attr("checked", o[p] ? "checked" : null);
    else
      el.val(o[p]);
  }
  return this;
}
