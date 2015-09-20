#!/usr/bin/env ruby
#
# @description writes i18n data to messages.json files

require "json"
require "fileutils"

SRC_PATH = "src"
BUILD_PATH = "build"

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

localesDir = File.join(SRC_PATH, "_locales")
i18nKeys = Array.new
localeData = Hash.new

# delete old built files
FileUtils.remove_dir(localesDir, true)

# create new data
JSON.parse(File.open(File.join(BUILD_PATH, "i18n.json")).read).each do |i18nKey, value|
    i18nKeys.push(i18nKey)

    value.each do |locale, data|
        localeData[locale] = localeData[locale] || Hash.new
        localeData[locale][i18nKey] = {"message" => data}
    end
end

# write files
localeData.each do |locale, data|
    localeDir = File.join(localesDir, locale)
    FileUtils.mkdir_p(localeDir)

    File.open(File.join(localeDir, "messages.json"), "w") do |f|
        f.write(JSON.generate(data))
    end
end
