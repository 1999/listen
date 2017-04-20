#!/usr/bin/env ruby
#
# @description build ZIP release file for Chrome Web Store

require "crxmake"

OUT_PATH = 'out'

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

CrxMake.zip(
    :ex_dir => OUT_PATH,
    :pkey => File.join(Dir.home, "Dropbox", "Keys", "ListenApp.pem"),
    :zip_output => File.join(OUT_PATH, "release.zip"),
    :verbose => false,
    :ignorefile => /\.swp/,
    :ignoredir => /\.(?:svn|git|cvs)/
)
