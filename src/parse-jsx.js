// utilities for parsing jsx block strings from MDX into slate schema
const babel = require('@babel/core');
const { declare } = require('@babel/helper-plugin-utils');
// eslint-disable-next-line global-require
const plugins = [require('@babel/plugin-syntax-jsx')];

class PluginGetRootElement {
  constructor() {
    const result = {
      props: {},
    };
    this.result = result;

    this.plugin = declare(babelInstance => {
      babelInstance.assertVersion(7);

      const visitProps = {
        JSXAttribute(path) {
          const key = path.node.name.name;
          // only handles string/static props
          const { value } = path.node.value;
          result.props[key] = value;
        },
      };

      return {
        visitor: {
          JSXOpeningElement(path) {
            // only parse root-level element
            if (result.type) return;
            result.type = path.node.name.name;
            path.traverse(visitProps);
          },
        },
      };
    });
  }
}

module.exports.parseJSXBlock = jsx => {
  const { plugin, result } = new PluginGetRootElement();
  try {
    babel.transformSync(jsx, {
      plugins: [...plugins, plugin],
    });
    const { type, props } = result;
    return {
      props,
      type,
    };
  } catch (e) {
    return {
      props: {},
    };
  }
};

// eslint-disable-next-line no-unused-vars
function pluginApplyProps(babelInstance, state) {
  let applied = false;
  const { types: t } = babelInstance;

  const addProps = (path, opts) => {
    const { props = {} } = opts;
    // eslint-disable-next-line no-restricted-syntax
    for (const key in props) {
      const value = props[key];
      const id = t.jSXIdentifier(key);
      const attribute = t.jSXAttribute(id, t.stringLiteral(value));
      const index = path.node.attributes.findIndex(
        attr => attr.name.name === key
      );
      if (index < 0) {
        path.node.attributes.push(attribute);
      } else {
        path.node.attributes[index] = attribute;
      }
    }
  };

  const visitor = {
    // eslint-disable-next-line no-shadow
    JSXOpeningElement(path, state) {
      // only apply props to root element
      if (applied) return;
      addProps(path, state.opts);
      applied = true;
    },
  };

  return {
    visitor,
  };
}

module.exports.applyProps = (jsx, opts) => {
  try {
    const result = babel.transformSync(jsx, {
      plugins: [...plugins, [pluginApplyProps, opts]],
    });
    const next = result.code.replace(/;$/, '');
    return next;
  } catch (e) {
    return jsx;
  }
};
