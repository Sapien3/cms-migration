// import pluginPkg from '../../package.json';
import Wysiwyg from './components/WysiwygWithErrors';
// import pluginId from './pluginId';

export default strapi => {
  // const pluginDescription = pluginPkg.strapi.description || pluginPkg.description;

  const plugin = {
    blockerComponent: null,
    blockerComponentProps: {},
    description: 'wysiwyg tinymce',
    // icon: pluginPkg.strapi.icon,
    id: 'wysiwyg',// pluginId,
    initializer: () => null,
    injectedComponents: [],
    isReady: true,
    isRequired: false,//pluginPkg.strapi.required || false,
    mainComponent: null,
    name: "wysiwyg",// pluginPkg.strapi.name,
    preventComponentRendering: false,
    settings: null,
    trads: {},
  };

  strapi.registerField({ type: 'wysiwyg', Component: Wysiwyg });

  return strapi.registerPlugin(plugin);
};
