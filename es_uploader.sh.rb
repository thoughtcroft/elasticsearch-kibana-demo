#!/usr/bin/env ruby

require 'csv'
require 'benchmark'
require 'elasticsearch'
require 'pry'


# we subclass file reading so we can fix quoting
# before CSV tries to parse the next line
#
class MyFile < File
  def gets(*args)
    line = super
    if line != nil
      line.gsub! '"', "'"
    end
    line
  end
end

def format_number(number)
  number.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\1,').reverse
end

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

batch_factor = (ARGV[1] || 200).to_i
report_factor = (ARGV[2] || 100).to_i

puts "\nStarting upload into Elasticsearch (each . is #{batch_factor} documents)\n"
puts " -> Connecting to Elasticsearch:\n\n"

client = Elasticsearch::Client.new host: 'dockerhost:9201'

# change mapping to allow full searches against content name
client.indices.put_mapping index: 'aris', type: 'content_read', body: content_read_mapping

row_count = 0
doc_count = 0
doc_array = []

time = Benchmark.realtime do

  csv = CSV.new(MyFile.open(ARGV[0]), headers: true, converters: :all)

  while row = csv.gets
    row_count += 1
    row_hash = row.to_hash
    doc_array << {
      index: {
        _index: 'aris',
        _type: 'content_read',
        _id: row_hash['UniqueId'],
        data: row_hash
      }
    }

    if row_count % batch_factor == 0
      begin
        client.bulk body: doc_array
        doc_count += doc_array.count
      rescue => e
        puts "\nERROR uploading #{format_number(row_count)}:#{e.message}\n#{doc_array}\n"
        next
      ensure
        doc_array = []
        print '.'
        puts " =  #{format_number(row_count)}" if row_count % (batch_factor * report_factor)  == 0
      end
    end
  end

  # check we have uploaded everything (if final row_count is not a multiple of batch_factor)
  unless doc_array.empty?
    client.bulk body: doc_array
    doc_count += doc_array.count
  end

end

puts "\n\nFinished uploading #{format_number(doc_count)} of #{format_number(row_count)} records into Elasticsearch"
puts " -> elapsed time = #{time.to_i} seconds at a rate of #{(doc_count / time).to_i} documents per second\n\n"
