#!/usr/bin/env ruby

# throw "Ruby-2.0 is required" if RUBY_VERSION < "2.0"

require "json"
require "rake/clean"
require "open3"

SRC_PATH = "src"
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

    settings = JSON.parse(File.open(File.join(BUILD_PATH, "settings.json")).read)
    constants = JSON.parse(File.open(File.join(BUILD_PATH, "constants.json")).read)

    File.open(File.join(SRC_PATH, "config.js"), "w") do |f|
        configChunks = {
            "default_settings_local" => settings["local"],
            "default_settings_sync" => settings["sync"],
            "constants" => constants,
            "buildInfo" => {
                :revision => sysrun("git rev-parse --verify HEAD")[0..9],
                :date => Time.now.to_i
            }
        }

        f.write("Config = " + JSON.pretty_generate(configChunks, {:indent => "    "}))
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

desc "Run this after you have cloned the repo"
task :default do
    Rake::Task["i18n"].execute
    Rake::Task["templates"].execute
    Rake::Task["rebuildConfig"].execute
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
