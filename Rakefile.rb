#!/usr/bin/env ruby

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

# throw "Ruby-2.0 is required" if RUBY_VERSION < "2.0"

require "json"
require "rake/clean"
require "open3"
require "crxmake"

SRC_PATH = "src"
OUT_PATH = "out"
BUILD_PATH = "build"

# Get some environment info and setup
# CLEAN.include(WORKING_SRC)
# CLOBBER.include(OUT_PATH)

desc "Writes i18n data to messages.json files"
task :i18n do
    puts "Write i18n data..."

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
end

desc "Rebuild config from settings and other data"
task :rebuildConfig do
    puts "Rebuilding config file..."

    jsConfig = buildConfig
    File.open(File.join(SRC_PATH, "config.js"), "w") do |f|
        f.write(jsConfig)
    end
end

desc "Builds templates into one file"
task :templates do
    puts "Combining templates into one file..."

    combined = Hash.new
    Dir.glob(File.join("templates", "*.mustache")).each do |fileName|
        fileContents = []

        IO.readlines(fileName).each do |line|
            fileContents.push(line.strip)
        end

        combined[File.basename(fileName, ".mustache")] = fileContents.join
    end

    File.open(File.join(SRC_PATH, "sandbox", "alltemplates.js"), "w") do |f|
        f.write("Templates = " + JSON.pretty_generate(combined, {:indent => "    "}))
    end
end

desc "Build ZIP for Chrome Web Store"
task :build => [:i18n, :templates] do
    puts "Building ZIP file for Chrome Web Store..."

    FileUtils.remove_dir(OUT_PATH, true)
    FileUtils.cp_r(SRC_PATH, OUT_PATH)

    tweaks = JSON.parse(File.open(File.join(BUILD_PATH, "config.cws.json")).read)
    jsConfig = buildConfig(tweaks)

    File.open(File.join(OUT_PATH, "config.js"), "w") do |f|
        f.write(jsConfig)
    end

    # update manifest
    manifestJSONPath = File.join(OUT_PATH, "manifest.json")
    manifestJSON = JSON.parse(File.open(manifestJSONPath).read)
    manifestJSON["name"] = manifestJSON["name"].gsub(/\sDEV$/, "")

    File.open(manifestJSONPath, "w") do |f|
        f.write(JSON.pretty_generate(manifestJSON))
    end

    # create release ZIP
    CrxMake.zip(
        :ex_dir => OUT_PATH,
        :pkey => File.join(Dir.home, "Dropbox", "Keys", "ListenApp.pem"),
        :zip_output => File.join(OUT_PATH, "release-" + manifestJSON["version"] + ".zip"),
        :verbose => false,
        :ignorefile => /\.swp/,
        :ignoredir => /\.(?:svn|git|cvs)/
    )

    # CrxMake.make(
    #     :ex_dir => OUT_PATH,
    #     :pkey => File.join(Dir.home, "Dropbox", "Keys", "ListenApp.pem"),
    #     :crx_output => File.join(OUT_PATH, "app.crx"),
    #     :verbose => false,
    #     :ignorefile => /\.swp/,
    #     :ignoredir => /\.(?:svn|git|cvs)/
    # )
end

desc "Run this after you have cloned the repo"
task :default => [:i18n, :templates, :rebuildConfig] do
    puts "Add CPA library..."
    srcPath = File.join("chrome-platform-analytics", "google-analytics-bundle.js")
    destPath = File.join(SRC_PATH, "lib", "cpa.js")
    FileUtils.copy_file(srcPath, destPath)

    sysrun("npm install")
end

########################################################################################################################
#########################################################################################################################
#########################################################################################################################

def sysrun(cmd)
    puts "Exec cmd: " + cmd

    data = {
        :out => Array.new,
        :err => Array.new
    }

    exit_status = 0

    Open3.popen3(cmd) do |stdin, stdout, stderr, wait_thr|
        { :out => stdout, :err => stderr }.each do |key, stream|
            while (line = stream.gets)
                data[key].push(line)
            end
        end

        # Don't exit until the external process is done
        exit_status = wait_thr.value.exitstatus.to_i
        wait_thr.join
    end

    throw "Error (#{exit_status}) running '#{cmd}': #{data[:err].join()}" if (exit_status > 0 || data[:err].length > 0)
    data[:out].join
end

def buildConfig(tweak_map = {})
    settings = JSON.parse(File.open(File.join(BUILD_PATH, "settings.json")).read)
    constants = JSON.parse(File.open(File.join(BUILD_PATH, "constants.json")).read)

    configChunks = {
        "default_settings_local" => mergeChunks(settings["local"], tweak_map["default_settings_local"]),
        "default_settings_sync" => mergeChunks(settings["sync"], tweak_map["default_settings_sync"]),
        "constants" => mergeChunks(constants, tweak_map["constants"]),
        "buildInfo" => {
            :revision => sysrun("git rev-parse --verify HEAD")[0..9],
            :date => Time.now.to_i
        }
    }

    "Config = " + JSON.pretty_generate(configChunks, {:indent => "    "})
end

def mergeChunks(original, tweak)
    if !tweak.nil?
        tweak.each do |key, value|
            if value.nil?
                original.delete(key)
            else
                original[key] = value
            end
        end
    end

    original
end
