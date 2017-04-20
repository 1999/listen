all:: build

clean::
	@echo "Delete node modules"
	@rm -fr ./node_modules

	@echo "Delete bower components"
	@rm -fr ./src/bower_components

	@echo "Delete all built files"
	@rm -fr ./out

# default target
build::
	@echo "Add CPA library..."
	@git submodule init
	@git submodule update
	@cp chrome-platform-analytics/google-analytics-bundle.js src/lib/cpa.js

	@echo "Install NPM dependencies..."
	@npm install --loglevel http
build:: i18n
build:: templates
build:: config

i18n::
	@echo "Write i18n data..."
	@ruby tools/i18n.rb

templates::
	@echo "Combining templates into one file..."
	@ruby tools/templates.rb

config::
	@echo "Rebuilding config file..."
	@node tools/build-config.js --tweakmap=$(TWEAK_MAP_PATH)

release:: TWEAK_MAP_PATH ?= build/config.cws.json
release::
	@echo "Building ZIP file for Chrome Web Store..."
	@rm -fr out/
	@cp -r src out
release:: config
	@echo "Update manifest..."
	@cat out/manifest.json | sed 's/ DEV//' > out/manifest.json

	@echo "Creating release ZIP..."
	@ruby tools/crx.rb

.PHONY: all build i18n templates config release
