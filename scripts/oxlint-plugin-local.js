const requireJsExtension = {
  meta: {
    fixable: "code",
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          !source.startsWith("./") &&
          !source.startsWith("../") &&
          !source.startsWith("~/")
        )
          return;
        // Skip imports that already have any extension (.js, .json, .css, …)
        if (/\.[^/]+$/.test(source)) return;
        context.report({
          node: node.source,
          message: `Relative import "${source}" must use a .js extension.`,
          fix(fixer) {
            const raw = context.sourceCode.getText(node.source);
            const quote = raw[0];
            return fixer.replaceText(
              node.source,
              `${quote}${source}.js${quote}`,
            );
          },
        });
      },
    };
  },
};

export default {
  meta: { name: "local" },
  rules: { "require-js-extension": requireJsExtension },
};
