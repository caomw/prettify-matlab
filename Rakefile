#!/usr/bin/env ruby

# default task
task :default => 'SO:build'

# source files to be processed
SOURCES = %w[lang-matlab.css lang-matlab.js prettify-matlab.user.js switch-lang.user.js prettify-mathworks-answers.user.js]

namespace :SO do
	desc 'Builds both userscript and prettify extension JS files from templates'
	task :build do
		for name in SOURCES
			outDir = File.extname(name)[1..-1]		# js or css
			r = Renderer.new("src/#{name}", "#{outDir}/#{name}")
			r.processFiles
		end
	end

	desc 'Run watchr'
	task :watchr do
		require 'rubygems'
		require 'watchr'
		script = Watchr::Script.new
		all_files = [Dir['src/*.js'], Dir['css/*.css']].join('|')
		script.watch(all_files) do |file|
			Rake::Task["SO:build"].execute
		end
		controller = Watchr::Controller.new(script, Watchr.handler.new)
		controller.run
	end
end

require 'erb'

class Renderer
	# class variables
	DETECT_FUNCTIONS = true

	# constructor: expects source/target filenames
	def initialize(source_fname, target_fname)
		@source_fname = source_fname
		@target_fname = target_fname
	end

	# process ERB template string (using current object context for evaluation)
	# and return result
	def render(str)
		str.gsub!(/\r\n?/, "\n")	# make sure ERB template has UNIX line endings!
		ERB.new(str, 0, "<>").result(get_binding)
	end

	# process source file and write output to target
	def processFiles()
		source = File.open(@source_fname, 'r')
		target = File.open(@target_fname, 'w')

		puts "Building #{target.path}"

		begin
			# read input, process it, and write output to target
			target << render(source.read)
		ensure
			source.close
			target.close
		end
	end

	# return file contents
	def get_file(filename)
		File.read(normalize_path(filename))
	end

	# yield file lines one at-a-time
	def get_file_lines(filename)
		file = File.open(normalize_path(filename), 'r')
		#file.read().each_line do |line|
		for line in file
			yield line.chomp
		end
		file.close
	end

	# return all file lines as an array
	def get_all_lines(filename)
		File.readlines(normalize_path(filename)).map(&:chomp)
	end

	# return absolute path (evaluated relative to source file)
	def normalize_path(filename)
		filename = File.join(File.dirname(@source_fname), filename.strip)
		filename = File.expand_path(filename)
	end

	# templating using current object's member data/methods
	def get_binding
		binding
	end
end
