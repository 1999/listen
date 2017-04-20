#!/usr/bin/env ruby
#
# @description builds templates into one file

require "json"

SRC_PATH = "src"

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

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
