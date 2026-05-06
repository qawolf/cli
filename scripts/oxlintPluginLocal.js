const requireJsExtension = {
  meta: {
    fixable: "code",
  },
  create(context) {
    const checkSource = (sourceNode) => {
      const source = sourceNode.value;
      if (
        typeof source !== "string" ||
        (!source.startsWith("./") &&
          !source.startsWith("../") &&
          !source.startsWith("~/"))
      )
        return;
      // Skip imports that already have any extension (.js, .json, .css, …)
      if (/\.[^/]+$/.test(source)) return;
      context.report({
        node: sourceNode,
        message: `Import "${source}" is missing an extension — add .js`,
        fix(fixer) {
          const raw = context.sourceCode.getText(sourceNode);
          const quote = raw[0];
          return fixer.replaceText(sourceNode, `${quote}${source}.js${quote}`);
        },
      });
    };

    return {
      ImportDeclaration(node) {
        checkSource(node.source);
      },
      ExportNamedDeclaration(node) {
        if (!node.source) return;
        checkSource(node.source);
      },
      ExportAllDeclaration(node) {
        if (!node.source) return;
        checkSource(node.source);
      },
    };
  },
};

export default {
  meta: { name: "local" },
  rules: { "require-js-extension": requireJsExtension },
};
