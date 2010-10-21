function(doc) {
  if (doc.type == "user") {
    emit(doc.name, doc)
  }
};
