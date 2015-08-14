#!/usr/bin/env ruby

require 'elasticsearch'
require 'csv'

rep_num = 100
puts "Starting upload into Elasticsearch (each . is #{rep_num})..."

puts "Connecting to Elasticsearch..."
client = Elasticsearch::Client.new host: 'dockerhost:9201'

row_num = 0

CSV.foreach(ARGV[0]) do |row|
  begin
    row_num =+ 1
    row_hash = row.to_hash

    client.index index: 'aris-test',
      type: 'read-content',
      id: row_hash['UniqueId'],
      body: row_hash

    print '.' if row_num % rep_num  == 0
  rescue => e
    puts "Failed on record #{row_num}: #{row_hash} due to #{e.message}"
    next
  end
end

puts "Finished upload into Elasticsearch"
