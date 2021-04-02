const colors = require("colors");
const semver = require("semver");

const config = require("../config");
const logger = require("../log").logger;

//
// ─── SERVICE REGISTRY ───────────────────────────────────────────────────────────
//

/******************************************************************************
 * In-memory store for registered services.
 *
 * Services are grouped by version tag (semver 2.0) into clusters. Clusters
 * behave as load balancers for grouped services with a round robin strategy.
 *
 * Service urls are provided from the registry upon request to fulfill service
 * client requests.
 *
 * Implementation is intended to be done at the router level and routes forward
 * request data to populate clusters. Duplicate entries are disallowed;
 * duplicates are considered to be services with the same version tag on the
 * same socket.
 *
 * Services are pruned from the registry at a regular interval if the services
 * fail to send a keep alive signal to the registry. The keep alive is also
 * consumed at the router level.
 */
class ServiceRegistry {
  constructor() {
    this.clusters = [];
    this.interval = 30;
    this.timestamp = _getTimestamp();
    logger.info(`Service registry created`);
    // prune unresponsive services on the given interval
    this.pruneInterval = setInterval(() => {
      let counter = 0;
      logger.info("Begin health check...");
      // case of no services
      if (!this.clusters.length) {
        logger.info("Registry empty; health check complete".green);
      }
      // case of at least one service cluster
      else {
        this.clusters.forEach((c) => {
          counter += c.prune(this.timestamp);
          // cleanup empty clusters
          if (!c.head) {
            const idx = this.clusters.indexOf(c);
            this.clusters.splice(idx, 1);
            logger.info(`Removed empty cluster ${c.hash.cyan}`);
          }
        });
        this.timestamp = _getTimestamp();
        // case of positive counter
        if (counter) {
          return logger.warn(`Health check complete; ${counter} services pruned`.red);
        }
        // case of zero count
        else return logger.info("Health check complete; no services pruned".green);
      }
    }, this.interval * 1000);
  }

  /****************************************************************************
   * Adds a new service to a service registry cluster defined by service name,
   * version and address. If a service registry cluster is not available for the
   * version of the service then one will be created. Clusters are ordered by
   * hash in descending order, thereby allowing requests for major or minor
   * service versions to select the most stable and up-to-date versions.
   *
   * @param {String} name Service name
   * @param {String} version Semver service version
   * @param {String} ip Service IP address
   * @param {Integer} port Service port
   *
   * @returns Http response message
   */
  registerService = function (name, version, ip, port) {
    const ipv = _formatIPV(ip);
    const service = new Service(name, version, ipv, port);
    // discover existing services with the same minor version
    const existing = this.clusters.find((s) => s.version === version);
    // case of existing service cluster
    if (existing) {
      existing.add(service);
      return `Service ${name} at version ${version} was successfully added to the registry.`; // prettier-ignore
    }
    // case of non-existent cluster
    else {
      const cluster = new ServiceCluster(name, version);
      this.clusters.push(cluster);
      this.clusters.sort((a, b) => (b.hash > a.hash ? 1 : -1));
      cluster.add(service);
      logger.info(`Created cluster ${cluster.hash.cyan}`);
      return `Service ${name} at version ${version} was successfully added to the registry.`; // prettier-ignore
    }
  };
  
  /****************************************************************************
   * Resets the timestamp of a specific service to prevent pruning.
   * 
   * @param {String} name Service name
   * @param {String} version Semver service version
   * @param {String} ip Service IP address
   * @param {Integer} port Service port 
   */
  keepService = function(name, version, ip, port) {
    const ipv = _formatIPV(ip);
    const hash = _formatServiceHash(name, version, ipv, port);
    // discover existing services with the same version
    const existing = this.clusters.find((c) => c.version === version);
    // case of non-existent cluster
    if (!existing) _error("Service cluster does not exist", 400);
    // case of existing service cluster
    else if (existing) {
      existing.keep(hash);
    }
  }

  /****************************************************************************
   * Removes a service from the service registry cluster if available. If a
   * service registry cluster is empty after removal of the service then the
   * registry will automatically remove the cluster.
   *
   * @param {String} name Service name
   * @param {String} version Semver service version
   * @param {String} ip Service IP address
   * @param {Integer} port Service port
   *
   * @returns Http response message
   */
  removeService = function (name, version, ip, port) {
    const ipv = _formatIPV(ip);
    const hash = _formatServiceHash(name, version, ipv, port);
    // discover existing services with the same version
    const existing = this.clusters.find((c) => c.version === version);
    // case of non-existent cluster
    if (!existing) _error("Service cluster does not exist", 400);
    // case of existing service cluster
    else if (existing) {
      existing.remove(hash);
      // case of empty cluster remove cluster
      if (!existing.head) {
        const idx = this.clusters.indexOf(existing);
        this.clusters.splice(idx, 1);
        logger.info(`Removed empty cluster ${existing.hash.cyan}`);
        return `Service ${name} at version ${version} was successfully removed from the registry.`; // prettier-ignore
      }
    }
  };

  /****************************************************************************
   * Gets a service hash (url) by name and version. When provided a patch
   * version the registry will find a cluster with the exact version and select
   * the service at the cluster's cursor. If provided a major or minor version
   * the registry will attempt to match a cluster that satisfies the version in
   * descending order, i.e. beginning with higher major and minor versions.
   *
   * @param {String} name Service name
   * @param {String} version Semver service version
   *
   * @returns Http response message
   */
  getService = function (name, version) {
    // case of empty registry
    if (!this.clusters.length) _error("Registry does not have any clusters", 404); // prettier-ignore
    // case of non-empty registry
    else {
      // find first cluster version that satisfies semver
      // and service name
      const cluster = this.clusters.find((c) => {
        return name === c.name && semver.satisfies(c.version, version);
      });
      // case of cluster non-existent
      if (!cluster) _error("Service cluster does not exist", 404);
      // case of cluster existing
      else {
        return cluster.get().hash;
      }
    }
  };

  /****************************************************************************
   * Returns a complete JSON-friendly list of registry clusters and services.
   *
   * @returns {Array<ServiceCluster>} Array of service clusters and services
   */
  getRegistry = function () {
    const output = [];
    this.clusters.forEach((c) => {
      output.push({
        hash: c.hash,
        services: c.getAll(),
      });
    });
    return output;
  };
}

//
// ─── SERVICE CLUSTER ────────────────────────────────────────────────────────────
//

class ServiceCluster {
  /****************************************************************************
   * @param {String} service Service name
   * @param {String} version Semver service version
   */
  constructor(service, version) {
    this.hash = _formatClusterHash(service, version);
    this.name = service;
    this.version = version;
    this.head = null;
    this.cursor = null;
  }

  /****************************************************************************
   * @param {Service} service instanceof `Service`
   */
  add = function (service) {
    let cur = this.head;
    // case of empty list
    if (!cur) {
      this.cursor = service;
      this.head = service;
      return logger.info(`Added service ${service.hash.cyan} to cluster ${this.hash.cyan}`); // prettier-ignore
    }
    // case of non-empty list
    while (cur) {
      // case of duplicate node
      if (cur.hash === service.hash) {
        return _error("Service is already in cluster", 400);
      }
      // case of non-duplicate node
      else if (!cur.next) {
        service.prev = cur;
        cur.next = service;
        return logger.info(`Added service ${service.hash.cyan} to cluster ${this.hash.cyan}`); // prettier-ignore
      }
      cur = cur.next;
    }
  };

  /****************************************************************************
   * @param {String} hash Service hash
   */
  keep = function(hash) {
    let cur = this.head;
    // case of empty list
    if (!cur) {
      return _error("Cluster is empty", 404);
    }
    // case of at least one node
    else if (cur) {
      while (cur) {
        if (cur.hash === hash) {
          cur.timestamp = _getTimestamp();
          return logger.info(`Keep alive received on ${cur.hash.cyan} from cluster ${this.hash.cyan}`); // prettier-ignore
        }
        cur = cur.next;
      }
    }
    // case of missing service
    return _error("Service not in cluster", 404);
  }
  
  /****************************************************************************
   * @param {String} hash Service hash
   */
  remove = function (hash) {
    let cur = this.head;
    // case of empty list
    if (!cur) {
      return _error("Cluster is empty", 404);
    }
    // case of at least one node
    else if (cur) {
      while (cur) {
        if (cur.hash === hash) {
          if (!cur.prev) {
            this.head = cur.next;
            this.head && (this.head.prev = null);
          } else if (cur.prev) {
            cur.prev.next = cur.next;
          }
          this.cursor = this.head;
          cur.prev = null;
          cur.next = null;
          return logger.info(`Removed service ${cur.hash.cyan} from cluster ${this.hash.cyan}`); // prettier-ignore
        }
        cur = cur.next;
      }
    }
    // case of missing service
    return _error("Service not in cluster", 404);
  };

  /****************************************************************************
   */
  get = function () {
    const cur = this.cursor;
    // case of empty list
    if (!cur) return _error("Cluster is empty", 404);
    // case of last node loop to head
    if (!cur.next) this.cursor = this.head;
    // case of first or mid node move to next
    else this.cursor = cur.next;
    // return the orig position not the new position
    return cur;
  };

  /****************************************************************************
   */
  prune = function (timestamp) {
    let counter = 0;
    let cur = this.head;
    // case of empty list
    if (!cur) return _error("Cluster is empty", 404);
    // case of at least one node
    else if (cur) {
      while (cur) {
        let nxt = cur.next;
        if (cur.timestamp < timestamp) {
          this.remove(cur.hash);
          counter++;
        }
        cur = nxt;
      }
    }
    return counter;
  };

  /****************************************************************************
   */
  getAll = function () {
    let cur = this.head;
    const output = [];
    // case of empty list
    if (!cur) return _error("Cluster is empty", 404);
    // case of one or more nodes
    else if (cur) {
      while (cur) {
        output.push({
          hash: cur.hash,
        });
        cur = cur.next;
      }
    }
    return output;
  };
}

//
// ─── SERVICE ────────────────────────────────────────────────────────────────────
//

class Service {
  constructor(name, version, ip, port) {
    this.timestamp = _getTimestamp();
    this.hash = _formatServiceHash(name, version, ip, port);
    this.prev = null;
    this.next = null;
  }
}

//
// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────────
//

_error = function (message, code) {
  const err = new Error(message);
  err.statusCode = code;
  throw err;
};

_formatIPV = function (ip) {
  if (config.ipv === "IPv4") return ip.replace("::ffff:", "");
  else return ip;
};

_formatClusterHash = function (name, version) {
  return `${name}/v${version}`;
};

_formatServiceHash = function (name, version, ip, port) {
  return `${ip}:${port}/${name}/v${version}`;
};

_formatMinorVersion = function (version) {
  return `${semver.major(version)}.${semver.minor(version)}`;
};

_getTimestamp = function () {
  return Date.parse(new Date()) / 1000;
};

module.exports = ServiceRegistry;
