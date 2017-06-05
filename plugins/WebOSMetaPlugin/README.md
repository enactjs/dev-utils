# webos-meta-webpack-plugin

> Webpack plugin that automatically detects and copies webOS meta assets.

## Usage

Simply include the plugin within your webpack configuration and both the `./appinfo.json` and `./webos-meta/appinfo.json` will be checked for existence.
If an appinfo is found, it will be scanned for any related webOS meta assets (icons, etc.) and copy them over at build time as well.

Additionally, if [html-webpack-plugin](https://github.com/ampedandwired/html-webpack-plugin) is in use, the appinfo title value will be used in the 
generated HTML file.

Full details on valid webOS appinfo.json properties are available at https://developer.lge.com/webOSTV/develop/web-app/app-developer-guide/app-metadata/

## Copyright and License Information

Unless otherwise specified, all content, including all source code files and
documentation files in this repository are:

Copyright (c) 2016-2017 LG Electronics

Unless otherwise specified or set forth in the NOTICE file, all content,
including all source code files and documentation files in this repository are:
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this content except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
