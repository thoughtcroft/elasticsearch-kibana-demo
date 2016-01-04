FROM kibana:4.3.1
MAINTAINER Warren Bain (warren@zunos.com)

# install the Timelion plugin
RUN /opt/kibana/bin/kibana plugin --install kibana/timelion
RUN chown -R kibana:kibana /opt/kibana
