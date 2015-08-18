#!/usr/bin/env ruby

require 'csv'
require 'benchmark'
require 'elasticsearch'
require 'optparse'
require 'pry'

# comma separate integers so that 99999 => 99,999
#
def format_number(number)
  number.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\1,').reverse
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
            untouched: {
              type: 'string',
              index: 'not_analyzed'
            }
          }
        }
      }
    }
  }
end

# The Magic Starts Here!

options = { host: 'dockerhost', port: '9201', skip: 0, batch: 100, report: 100 }

OptionParser.new do |opts|
  opts.banner = "Usage: #{__FILE__} [options]"
  opts.separator ""
  opts.on('-h', '--host HOST',  "Elasticsearch HOST (#{options[:host]})") { |h| options[:host] = h }
  opts.on('-p', '--port PORT',  "Elasticsearch PORT (#{options[:port]})") { |p| options[:port] = p }
  opts.on('-f', '--file FILE',  "FILE of csv documents to upload") { |f| options[:file] = f }
  opts.on('-s', '--skip NUM',   "Skip the first NUM records (#{options[:skip]})") { |s| options[:skip] = s.to_i }
  opts.on('-b', '--batch NUM',  "Upload documents in batches of NUM (#{options[:batch]})") { |b| options[:batch] = b.to_i }
  opts.on('-r', '--report NUM', "Report upload count every NUM batches (#{options[:report]})") { |r| options[:report] = r.to_i }
end.parse!

raise "You must supply a file name!" unless options[:file]

puts "\nStarting upload into Elasticsearch using #{options}"

puts "-> Connecting to Elasticsearch"
client = Elasticsearch::Client.new host: "#{options[:host]}:#{options[:port]}"

puts "-> Updating index mapping"
client.indices.put_mapping index: 'aris', type: 'content_read', body: content_read_mapping

row_count = -1
doc_count = 0
doc_array = []
headers = nil

time = Benchmark.realtime do

  File.foreach(options[:file]) do |line|
    begin
      # first line is a header row so process and skip to next
      headers ||= CSV.parse_line(line)
      row_count += 1
      next unless row_count > 0

      puts "-> Skipping #{format_number(options[:skip])} rows" if options[:skip] > 0
      next unless row_count > options[:skip]

      row = CSV.parse_line(line, headers: headers, converters: :all)
      doc_array << {
        index: {
          _index: 'aris',
          _type: 'content_read',
          _id: row['UniqueId'],
          data: row.to_hash
        }
      }

      if row_count % options[:batch] == 0
        client.bulk refresh: false, body: doc_array
        doc_count += doc_array.count
        doc_array = []
        print '.'
        puts " =  #{format_number(row_count)}" if row_count % (options[:batch] * options[:report])  == 0
      end
    rescue CSV::MalformedCSVError => e
      puts "\nERROR parsing #{format_number(row_count)} : #{e.message} : #{line}"
    rescue => e
      puts "\nERROR uploading #{format_number(row_count)} : #{e.message} : #{doc_array}"
    end
  end

  # check we have uploaded everything (if final row_count is not a multiple of batch_factor)
  unless doc_array.empty?
    client.bulk refresh: false, body: doc_array
    doc_count += doc_array.count
  end
end

puts "\n\nFinished uploading #{format_number(doc_count)} of #{format_number(row_count)} records into Elasticsearch"
puts " -> elapsed time = #{time.to_i} seconds at a rate of #{(doc_count / time).to_i} documents per second\n\n"
