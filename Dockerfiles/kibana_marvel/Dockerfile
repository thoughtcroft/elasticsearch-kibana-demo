FROM kibana:4.3.1
MAINTAINER Warren Bain (warren@zunos.com)

# install the Marvel plugin
RUN /opt/kibana/bin/kibana plugin --install elasticsearch/marvel
RUN chown -R kibana:kibana /opt/kibana
