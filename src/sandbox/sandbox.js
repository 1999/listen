(function () {
    var compiledTemplates = {};

    window.addEventListener("message", function (evt) {
        var output = {
            id: evt.data.id,
            content: ""
        };

        if (Templates[evt.data.tplName]) {
            compiledTemplates[evt.data.tplName] = compiledTemplates[evt.data.tplName] || Hogan.compile(Templates[evt.data.tplName]);
            output.content = compiledTemplates[evt.data.tplName].render(evt.data.placeholders);
        }

        evt.source.postMessage(output, evt.origin);
    });
})();
