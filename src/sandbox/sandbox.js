(function () {
    var compiled = {};

    window.addEventListener("message", function (evt) {
        var output = {
            id: evt.data.id,
            content: ""
        };

        if (Templates[evt.data.tplName]) {
            if (!compiled[evt.data.tplName]) {
                var compiledTemplate = Hogan.compile(Templates[evt.data.tplName]);
                var depsMatches = Templates[evt.data.tplName].match(/\{\{>\s?.+?\}\}/g) || [];

                var partials = {};
                depsMatches.forEach(function (match) {
                    var partialName = match.replace(/\{\{>\s?(.+?)\}\}/, "$1");

                    if (Templates[partialName]) {
                        partials[partialName] = Templates[partialName];
                    }
                });

                compiled[evt.data.tplName] = {
                    template: compiledTemplate,
                    partials: partials
                };
            }

            var compiledData = compiled[evt.data.tplName]
            output.content = compiledData.template.render(evt.data.placeholders, compiledData.partials);
        }

        evt.source.postMessage(output, evt.origin);
    });
})();
