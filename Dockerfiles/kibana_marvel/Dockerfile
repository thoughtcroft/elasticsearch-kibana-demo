FROM kibana
MAINTAINER Warren Bain (warren@zunos.com)

# install the Marvel plugin
ENV MARVEL_VERSION 2.1.1
RUN /opt/kibana/bin/kibana plugin --install elasticsearch/marvel/$MARVEL_VERSION
RUN chown -R kibana:kibana /opt/kibana
