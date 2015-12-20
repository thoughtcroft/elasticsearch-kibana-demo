FROM elasticsearch
MAINTAINER Warren Bain (warren@zunos.com)

# install the various plugins
ENV ES_VERSION 2.1.0
RUN cd /usr/share/elasticsearch/bin && \
  ./plugin install license && \
  ./plugin install marvel-agent && \
  ./plugin install discovery-multicast \

RUN cd /usr/share/elasticsearch/bin && \
  ./plugin install lmenezes/elasticsearch-kopf && \
  ./plugin install mobz/elasticsearch-head && \
  ./plugin install royrusso/elasticsearch-HQ

# ensure ownership is correct
RUN chown -R elasticsearch:elasticsearch /usr/share/elasticsearch
