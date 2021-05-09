const MarkdownSerializer = require('slate-mdast-serializer');
const unified = require('unified');
const remarkStringify = require('remark-stringify');
const remarkParse = require('remark-parse');
const remarkSqueezeParagraphs = require('remark-squeeze-paragraphs');
const mdx = require('remark-mdx');
const { Data } = require('slate');

const { getComponentName, toJS } = require('./util');
const { parseJSXBlock, applyProps } = require('./parse-jsx');
const remarkInterleave = require('./remark-interleave').default;

const parser = unified()
  .use(remarkParse, {
    commonmark: true,
    position: false,
  })
  .use(remarkSqueezeParagraphs)
  .use(remarkInterleave)
  .use(mdx);

export const parseMDX = md => parser.runSync(parser.parse(md));

const stringifier = unified()
  .use(remarkStringify, {
    bullet: '*',
    fences: true,
  })
  .use(remarkSqueezeParagraphs)
  .use(mdx);

export const stringifyMDX = mdast =>
  stringifier.stringify(stringifier.runSync(mdast));

const paragraph = {
  fromMdast: (node, _index, parent, { visitChildren }) => {
    return {
      nodes: visitChildren(node),
      object: 'block',
      type: 'paragraph',
    };
  },
  match: node => node.object === 'block' && node.type === 'paragraph',
  matchMdast: node => node.type === 'paragraph',
  toMdast: (object, _index, parent, { visitChildren }) => {
    return {
      children: visitChildren(object),
      type: 'paragraph',
    };
  },
};

const br = {
  // eslint-disable-next-line no-unused-vars
  fromMdast: (node, _index, _parent, { visitChildren }) => {
    return {
      leaves: [
        {
          object: 'leaf',
          text: '\n',
        },
      ],
      object: 'text',
    };
  },
  match: node => node.type === 'break',
  matchMdast: node => node.type === 'break',
};

const image = {
  fromMdast: node => {
    return {
      data: {
        alt: node.alt,
        src: node.url,
      },
      isVoid: true,
      nodes: [],
      object: 'block',
      type: 'image',
    };
  },
  match: node => node.object === 'block' && node.type === 'image',
  matchMdast: node => node.type === 'image',
  toMdast: object => {
    return {
      alt: object.data.alt,
      type: 'image',
      url: object.data.src,
    };
  },
};

const blockQuote = {
  fromMdast: (node, index, parent, { visitChildren }) => ({
    nodes: visitChildren(node),
    object: 'block',
    type: 'block-quote',
  }),
  match: node => node.object === 'block' && node.type === 'block-quote',
  matchMdast: node => node.type === 'blockquote',
  toMdast: (object, index, parent, { visitChildren }) => ({
    children: visitChildren(object),
    type: 'blockquote',
  }),
};

const bulletedList = {
  fromMdast: (node, _index, _parent, { visitChildren }) => ({
    nodes: visitChildren(node),
    object: 'block',
    type: 'bulleted-list',
  }),
  match: node => node.object === 'block' && node.type === 'bulleted-list',
  matchMdast: node => node.type === 'list' && !node.ordered,
  toMdast: (object, _index, _parent, { visitChildren }) => {
    return {
      children: visitChildren(object),
      ordered: false,
      type: 'list',
    };
  },
};

const numberedList = {
  fromMdast: (node, _index, _parent, { visitChildren }) => ({
    nodes: visitChildren(node),
    object: 'block',
    type: 'numbered-list',
  }),
  match: node => node.object === 'block' && node.type === 'numbered-list',
  matchMdast: node => node.type === 'list' && node.ordered,
  toMdast: (object, _index, _parent, { visitChildren }) => {
    return {
      children: visitChildren(object),
      ordered: true,
      type: 'list',
    };
  },
};

const listItem = {
  fromMdast: (node, index, parent, { visitChildren }) => {
    return {
      nodes: visitChildren(node),
      object: 'block',
      type: 'list-item',
    };
  },
  match: node => node.object === 'block' && node.type === 'list-item',
  matchMdast: node => node.type === 'listItem',
  toMdast: (object, _index, _parent, { visitChildren }) => {
    return {
      children: visitChildren(object),
      type: 'listItem',
    };
  },
};

const listItemChild = {
  fromMdast: (node, index, parent, { visitChildren }) => {
    return {
      nodes: visitChildren(node),
      object: 'block',
      type: 'list-item-child',
    };
  },
  match: node => node.object === 'block' && node.type === 'list-item-child',
  matchMdast: (node, _index, parent) =>
    node.type === 'paragraph' && parent.type === 'listItem',
  toMdast: (object, _index, parent, { visitChildren }) => {
    return {
      children: visitChildren(object),
      type: 'paragraph',
    };
  },
};

const headings = [
  'heading-one',
  'heading-two',
  'heading-three',
  'heading-five',
  'heading-six',
]
  .map((nodeType, headingOffset) => {
    return {
      fromMdast: (node, index, parent, { visitChildren }) => ({
        nodes: visitChildren(node),
        object: 'block',
        type: nodeType,
      }),
      match: node => node.object === 'block' && node.type === nodeType,
      matchMdast: node =>
        node.type === 'heading' && node.depth === headingOffset + 1,
      toMdast: (object, index, parent, { visitChildren }) => ({
        children: visitChildren(object),
        depth: headingOffset + 1,
        type: 'heading',
      }),
    };
  })
  .reverse();

const bold = {
  fromMdast: (node, index, parent, { visitChildren }) => {
    return {
      nodes: visitChildren(node),
      object: 'mark',
      type: 'bold',
    };
  },
  match: node => node.object === 'mark' && node.type === 'bold',
  matchMdast: node => node.type === 'strong',
  toMdast: (mark, index, parent, { visitChildren }) => {
    return {
      children: visitChildren(mark),
      type: 'strong',
    };
  },
};

const codeBlock = {
  // eslint-disable-next-line no-unused-vars
  fromMdast: (node, _index, _parent, { visitChildren }) => {
    return {
      nodes: [
        {
          leaves: [
            {
              object: 'leaf',
              text: node.value,
            },
          ],
          object: 'text',
        },
      ],
      object: 'block',
      type: 'pre',
    };
  },
  match: node => node.object === 'block' && node.type === 'pre',
  matchMdast: node => node.type === 'code',
  toMdast: (node, _index, _parent, { visitChildren }) => {
    return {
      type: 'code',
      value: visitChildren(node)
        .map(childNode => childNode.value)
        .filter(Boolean)
        .join('\n'),
    };
  },
};

const code = {
  // eslint-disable-next-line no-unused-vars
  fromMdast: (node, index, parent, { visitChildren }) => {
    return {
      nodes: [
        {
          leaves: [
            {
              marks: [],
              object: 'leaf',
              text: node.value,
            },
          ],
          object: 'text',
        },
      ],
      object: 'mark',
      type: 'code',
    };
  },
  match: node => node.object === 'mark' && node.type === 'code',
  matchMdast: node => node.type === 'inlineCode',
  toMdast: (mark, index, parent, { visitChildren }) => {
    return {
      type: 'inlineCode',
      value: visitChildren(mark)
        .map(childNode => childNode.value)
        .join(''),
    };
  },
};

const italic = {
  fromMdast: (node, index, parent, { visitChildren }) => ({
    nodes: visitChildren(node),
    object: 'mark',
    type: 'italic',
  }),
  match: node => node.object === 'mark' && node.type === 'italic',
  matchMdast: node => node.type === 'emphasis',
  toMdast: (mark, index, parent, { visitChildren }) => ({
    children: visitChildren(mark),
    type: 'emphasis',
  }),
};

// Inline doesn't currently work correctly
// What happens is:
// Given input like this:
//  plain text in a paragraph <span>jsx children</span>.
// it thinks that <span> is a jsx node and </span> is a jsx node, but jsx children is not
// Currently, this editor doesn't seem to support inline JSX though.
// rendering this doesn't break anything, it just doesn't really do anything special.
const jsxMark = {
  // eslint-disable-next-line no-unused-vars
  fromMdast: (node, index, parent, { visitChildren, context }) => {
    return {
      nodes: [],
      object: 'mark',
      text: node.value,
      type: 'jsx',
    };
  },
  match: node => {
    return node.type === 'jsx' && node.object === 'mark';
  },
  matchMdast: (node, index, parent) => {
    return node.type === 'jsx' && (!parent || parent.type !== 'root');
  },
  toMdast: (mark, index, parent, { visitChildren }) => {
    return {
      type: 'jsx',
      value: visitChildren(mark)
        .map(childNode => childNode.value)
        .join(),
    };
  },
};

const isJSX = node => {
  if (node.object !== 'block') return false;
  return node.type === 'jsx' || node.type === 'jsx-void';
};

const jsxBlock = {
  fromMdast: (node, index, parent, { visitChildren }) => {
    let data = {};
    if (node.children) {
      data = {
        props: {},
        type: getComponentName(node.children[0].value),
      };

      // Remove open and closing jsx blocks
      // eslint-disable-next-line no-param-reassign
      node.children = node.children.slice(1, node.children.length - 1);

      return {
        data: {
          props: Data.create(data.props),
          type: data.type,
        },
        nodes: visitChildren(node),
        object: 'block',
        type: 'jsx',
      };
    }
    data = parseJSXBlock(node.value);
    return {
      data: {
        props: Data.create(data.props),
        type: data.type,
      },
      object: 'block',
      type: 'jsx-void',
    };
  },
  match: isJSX,
  matchMdast: (node, index, parent) =>
    node.type === 'jsx' && parent && parent.type === 'root',
  toMdast: (object, index, parent, { visitChildren }) => {
    const props = toJS(object.data.props);

    if (!object.data.type) {
      return {
        type: 'jsx',
        value: visitChildren(object)[0].value,
      };
    }

    const value = applyProps(`<${object.data.type} />`, { props });

    if (object.type === 'jsx-void') {
      return {
        type: 'jsx',
        value,
      };
    }

    const children = visitChildren(object);
    return [
      {
        type: 'jsx',
        value: value.replace(/ \/>$/, '>'),
      },
      ...children,
      {
        type: 'jsx',
        value: `</${object.data.type}>`,
      },
    ];
  },
};

const link = {
  fromMdast: (node, index, parent, { visitChildren }) => {
    return {
      data: {
        href: node.url,
        target: node.target,
        title: node.title,
      },
      nodes: visitChildren(node),
      object: 'inline',
      type: 'link',
    };
  },
  match: node => node.object === 'inline' && node.type === 'link',
  matchMdast: node => node.type === 'link',
  toMdast: (mark, index, parent, { visitChildren }) => ({
    children: visitChildren(mark),
    target: mark.data.target,
    title: mark.data.title,
    type: 'link',
    url: mark.data.href,
  }),
};

export const serializer = new MarkdownSerializer({
  rules: [
    listItemChild, // We want this to run before paragraph because it's a special case
    paragraph,
    br,
    bold,
    code,
    italic,
    jsxMark,
    blockQuote,
    jsxBlock,
    codeBlock,
    image,
    link,
    bulletedList,
    numberedList,
    listItem,
  ].concat(headings),
});
