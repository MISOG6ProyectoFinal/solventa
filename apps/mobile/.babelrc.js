const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

function readEnv(filePath) {
  const values = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function inlineEnv(env) {
  return function inlineEnvPlugin() {
    return {
      visitor: {
        MemberExpression(nodePath) {
          const node = nodePath.node;
          const object = node.object;
          if (
            object.type !== 'MemberExpression' ||
            object.object.type !== 'Identifier' ||
            object.object.name !== 'process' ||
            object.property.type !== 'Identifier' ||
            object.property.name !== 'env' ||
            node.property.type !== 'Identifier' ||
            node.computed ||
            object.computed ||
            !Object.prototype.hasOwnProperty.call(env, node.property.name)
          ) {
            return;
          }

          nodePath.replaceWith({
            type: 'StringLiteral',
            value: env[node.property.name],
          });
        },
      },
    };
  };
}

module.exports = function configureBabel(api) {
  api.cache.using(() => fs.readFileSync(envPath, 'utf8'));
  return {
    presets: [['module:@react-native/babel-preset', { useTransformReactJSX: true }]],
    plugins: [inlineEnv(readEnv(envPath)), 'react-native-reanimated/plugin'],
  };
};
