FROM kibana
MAINTAINER Warren Bain (warren@zunos.com)

# install the Timelion plugin
ENV TIMELION_VERSION latest
RUN /opt/kibana/bin/kibana plugin --install kibana/timelion/$TIMELION_VERSION
RUN chown -R kibana:kibana /opt/kibana
