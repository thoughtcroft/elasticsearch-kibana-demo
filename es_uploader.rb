#!/usr/bin/env ruby

require 'csv'
require 'date'
require 'benchmark'
require 'elasticsearch'
require 'optparse'
require 'json'

# comma separate integers so that 99999 => 99,999
#
def format_number(number)
  number.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\1,').reverse
end

# clean up the byte order mark from first line of file
#
def remove_bom(contents)
  contents.sub("\xEF\xBB\xBF", '')
end

# need to convert our dates to a format recognisable by
# Elasticsearch. Tried mappings but didn't work. Go figure.
#
def format_date(date)
  DateTime.parse(date).strftime('%FT%T+0000')
end

# print current line (reprint after error for example)
#
def print_current_progress(row_count, options)
  print '.' * ((row_count % (options[:batch] * options[:report])) / options[:report])
end

# specific mapping defined to provide a field for the contentname
# that allows matching against the entire field and not just terms
#
def content_read_mapping
  {
    content_read: {
      properties: {
        ContentName: {
          type: 'string',
          fields: {
            raw: { type: 'string', index: 'not_analyzed' }
          }
        },
        OrganisationName: {
          type: 'string',
          fields: {
            raw: { type: 'string', index: 'not_analyzed' }
          }
        }
      }
    }
  }
end

# The Magic Starts Here!

options = {
  host: 'dockerhost',
  port: '9201',
  timeout: 5*60,
  skip: 0,
  limit: 0,
  batch: 100,
  report: 100,
  index: 'zunos'
}

OptionParser.new do |opts|
  opts.banner = "Usage: #{__FILE__} [options]"
  opts.separator ""
  opts.on('-h', '--host HOST', "Elasticsearch HOST (#{options[:host]})") { |h| options[:host] = h }
  opts.on('-p', '--port PORT', "Elasticsearch PORT (#{options[:port]})") { |p| options[:port] = p }
  opts.on('-t', '--timeout SECS', "Set SECS for timeout period for Elasticsearch connection (#{options[:timeout]})") { |t| options[:timeout] = t.to_i }
  opts.on('-f', '--file FILE', "FILE of csv documents to upload") { |f| options[:file] = f }
  opts.on('-i', '--index INDEX', "Elasticsearch INDEX (#{options[:index]})") { |i| options[:index] = i }
  opts.on('-s', '--skip NUM', "Skip the first NUM records (#{options[:skip]})") { |s| options[:skip] = s.to_i }
  opts.on('-l', '--limit NUM', "Limit processing to NUM records (#{options[:limit]})") { |l| options[:limit] = l.to_i }
  opts.on('-b', '--batch NUM', "Upload documents in batches of NUM (#{options[:batch]})") { |b| options[:batch] = b.to_i }
  opts.on('-r', '--report NUM', "Report upload count every NUM batches (#{options[:report]})") { |r| options[:report] = r.to_i }
end.parse!

raise "You must supply a file name!" unless options[:file]

puts "\nStarting upload into Elasticsearch using:"
puts JSON.pretty_generate options

puts "\n-> Connecting to Elasticsearch"
client = Elasticsearch::Client.new host: "#{options[:host]}:#{options[:port]}", timeout: options[:timeout]
puts JSON.pretty_generate client.cluster.health

puts "\n-> Updating index mapping"
client.indices.put_mapping(index: options[:index], type: 'content_read', body: content_read_mapping)

puts "-> Limit upload to #{format_number(options[:limit])} rows" if options[:limit] > 0
puts "-> Skipping #{format_number(options[:skip])} rows" if options[:skip] > 0

row_count = -1
doc_count = 0
doc_array = []
headers = nil

time = Benchmark.realtime do

  File.foreach(options[:file]) do |line|
    begin
      # first line is a header row so process and skip to next
      headers ||= CSV.parse_line(remove_bom(line))
      row_count += 1
      next unless row_count > 0

      # only process records in the desired range skip > data < limit
      next unless row_count > options[:skip]
      break if options[:limit] > 0 && doc_count >= options[:limit]

      # analyse fields and fix dates to be Elasticsearch friendly
      row = CSV.parse_line(line, headers: headers, converters: :all)
      %w(ViewDateUtc CreateDateUtc).each { |f| row[f] = format_date(row[f]) }
      row['GroupList']  = row['GroupList'].split('; ')
      row['@timestamp'] = row['ViewDateUtc']

      doc_array << {
        index: {
          _index: options[:index],
          _type: 'content_read',
          _id: row['UniqueId'],
          data: row.to_hash
        }
      }

      if row_count % options[:batch] == 0
        tries = 3
        client.bulk refresh: false, body: doc_array
        doc_count += doc_array.count
        doc_array = []
        print '.'
        puts " =  #{format_number(row_count)}" if row_count % (options[:batch] * options[:report])  == 0
      end
    rescue CSV::MalformedCSVError => e
      puts "\nERROR parsing #{format_number(row_count)} : #{e.message} : #{line}"
      print_current_progress(row_count, options)
    rescue Net::ReadTimeout, Errno::EHOSTUNREACH, Errno::ETIMEDOUT, Errno::ECONNRESET => e
      retry unless (tries-= 1).zero?
      puts "\nERROR processing #{format_number(row_count)}"
      raise
    rescue => e
      puts "\nERROR processing #{format_number(row_count)}"
      raise
    end
  end

  # check we have uploaded everything (if final row_count is not a multiple of batch_factor)
  unless doc_array.empty?
    client.bulk refresh: false, body: doc_array
    doc_count += doc_array.count
  end
end

# actual documents read has to be adjusted for skip factor
read_count = row_count - options[:skip]
puts "\nFinished uploading #{format_number(doc_count)} of #{format_number(read_count)} records into Elasticsearch"
puts " -> elapsed time = #{time.to_i} seconds at a rate of #{(doc_count / time).to_i} documents per second\n\n"
