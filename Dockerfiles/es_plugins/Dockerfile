FROM elasticsearch:2.1.1
MAINTAINER Warren Bain (warren@thoughtcroft.com)

# install the various plugins
RUN cd /usr/share/elasticsearch/bin && \
  ./plugin install license && \
  ./plugin install marvel-agent && \
  ./plugin install discovery-multicast

RUN cd /usr/share/elasticsearch/bin && \
  ./plugin install lmenezes/elasticsearch-kopf && \
  ./plugin install mobz/elasticsearch-head && \
  ./plugin install royrusso/elasticsearch-HQ

# ensure ownership is correct
RUN usermod -u 1000 elasticsearch && \
  groupmod -g 5000 staff && \
  groupmod -g 50 elasticsearch

RUN cd /usr/share/elasticsearch && \
  for FOLDER in logs plugins; do \
    chown -R elasticsearch:elasticsearch $FOLDER; \
  done
