module.exports = {
  packagerConfig: {
    name: 'Image Editor',
    executableName: 'image-editor',
    asar: true,
    icon: './assets/icon', // Will use .icns for Mac, .ico for Windows
    appBundleId: 'com.imageeditor.app',
    appCategoryType: 'public.app-category.graphics-design',
    win32metadata: {
      CompanyName: 'Image Editor',
      FileDescription: 'A minimal image editor',
      ProductName: 'Image Editor'
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ImageEditor',
        authors: 'Image Editor Team',
        description: 'A minimal image editor with drawing and editing tools'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32']
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'Image Editor',
        format: 'ULFO'
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Image Editor Team',
          homepage: 'https://github.com/yourusername/minimal-image-editor'
        }
      }
    }
  ]
};
