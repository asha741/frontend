$(document).ready(function () {
  function initProfilePanelToggle() {
    var actionButtons = document.querySelectorAll(
      "[data-ma-profile-panel-target]",
    );

    if (!actionButtons.length) {
      return;
    }

    var detailsPanel = document.getElementById("maProfileDetailsPanel");
    var passwordPanel = document.getElementById("maProfilePasswordPanel");
    var panelTitle = document.getElementById("maProfilePanelTitle");

    if (!detailsPanel || !passwordPanel || !panelTitle) {
      return;
    }

    function setActivePanel(target) {
      var showPassword = target === "password";

      detailsPanel.classList.toggle("d-none", showPassword);
      passwordPanel.classList.toggle("d-none", !showPassword);
      panelTitle.textContent = showPassword
        ? "Change Password"
        : "Profile Details";

      actionButtons.forEach(function (button) {
        var isActive =
          button.getAttribute("data-ma-profile-panel-target") === target;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");

        if (button.classList.contains("btn-outline-primary")) {
          button.classList.toggle("btn-primary", isActive);
          button.classList.toggle("btn-outline-primary", !isActive);
        }
      });
    }

    actionButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActivePanel(button.getAttribute("data-ma-profile-panel-target"));
      });
    });

    if (window.location.hash === "#change-password") {
      setActivePanel("password");
    }
  }

  function initRolePermissionMatrix() {
    var matrixTables = document.querySelectorAll(".ma-role-permission-table");

    if (!matrixTables.length) {
      return;
    }

    matrixTables.forEach(function (table) {
      var rowSelectAllBoxes = table.querySelectorAll(
        "[data-ma-role-select-all-row]",
      );

      rowSelectAllBoxes.forEach(function (selectAllBox) {
        var row = selectAllBox.closest("tr");

        if (!row) {
          return;
        }

        var permissionBoxes = row.querySelectorAll("[data-ma-role-permission]");

        function syncSelectAllState() {
          var allChecked =
            permissionBoxes.length > 0 &&
            Array.prototype.every.call(permissionBoxes, function (checkbox) {
              return checkbox.checked;
            });
          selectAllBox.checked = allChecked;
        }

        selectAllBox.addEventListener("change", function () {
          permissionBoxes.forEach(function (checkbox) {
            checkbox.checked = selectAllBox.checked;
          });
        });

        permissionBoxes.forEach(function (checkbox) {
          checkbox.addEventListener("change", syncSelectAllState);
        });

        syncSelectAllState();
      });
    });
  }

  initProfilePanelToggle();
  initRolePermissionMatrix();

  /* ===============================
       Replace SVG
    =============================== */
  $("img.ma-svg, img.am-svg").each(function () {
    var $img = $(this);
    var imgID = $img.attr("id");
    var imgClass = $img.attr("class");
    var imgURL = $img.attr("src");

    $.get(
      imgURL,
      function (data) {
        var $svg = $(data).find("svg");

        if (imgID) $svg.attr("id", imgID);
        if (imgClass) $svg.attr("class", imgClass + " replaced-svg");

        $svg.removeAttr("xmlns:a");
        $img.replaceWith($svg);
      },
      "xml",
    );
  });

  /* ===============================
       Custom Scrollbar
    =============================== */
  if ($(window).width() > 1025 && $.fn.mCustomScrollbar) {
    $(".ma-custom-scrollbar").mCustomScrollbar({
      theme: "dark-2",
      scrollInertia: 0,
    });
  }

  /* ===============================
       MatchHeight
    =============================== */
  if ($.fn.matchHeight) {
    $(".ma-match-height").matchHeight();
  }

  /* ===============================
       Bootstrap Tooltips
    =============================== */
  if (typeof bootstrap !== "undefined" && bootstrap.Tooltip) {
    $('[data-bs-toggle="tooltip"]').each(function () {
      new bootstrap.Tooltip(this);
    });
  }

  /* ===============================
       Login Role Switcher
    =============================== */
  if ($(".ma-role-switcher").length) {
    var $roleButtons = $(".ma-role-switcher .ma-role-btn");
    var $submitText = $("#maSignInBtn span");

    $roleButtons.on("click", function () {
      var $button = $(this);
      var role = $button.data("role");

      $roleButtons.removeClass("active").attr("aria-pressed", "false");
      $button.addClass("active").attr("aria-pressed", "true");
      $submitText.text("Sign In as " + role);
    });
  }

  /* ===============================
       Password Toggle
    =============================== */
  $("#maPasswordToggle").on("click", function () {
    var $passwordInput = $("#maPassword");
    var $icon = $(this).find("i");
    var isPassword = $passwordInput.attr("type") === "password";

    $passwordInput.attr("type", isPassword ? "text" : "password");
    $(this).attr("aria-pressed", isPassword ? "true" : "false");
    $icon.toggleClass("fa-eye fa-eye-slash");
  });

  /* ===============================
       Login Form Validation
    =============================== */
  if ($("#maLoginForm").length) {
    $("#maLoginForm").on("submit", function (event) {
      if (!this.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      $(this).addClass("was-validated");
    });
  }

  /* ===============================
       Flatpickr
    =============================== */
  if (typeof flatpickr !== "undefined") {
    $(".ma-date-picker").each(function () {
      flatpickr(this, {
        dateFormat: "Y-m-d",
        allowInput: true,
      });
    });
  }

  /* ===============================
       Dashboard Line Charts
    =============================== */
  if (typeof Chart !== "undefined") {
    var chartColors = {
      primaryBlue: "#4A76FD",
      tooltipBg: "#0F172A",
      white: "#FFFFFF",
      grid: "#E9EEF8",
      axisText: "#667085",
      pointShadow: "rgba(15, 23, 42, 0.12)",
    };

    var chartTypography = {
      axisFontSize: 13,
      axisFontWeight: "500",
    };

    var commonLineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest",
        intersect: true,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.white,
          bodyColor: chartColors.white,
          displayColors: false,
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: {
            color: chartColors.grid,
            drawBorder: false,
            drawTicks: false,
            z: -1,
          },
          border: {
            display: false,
          },
          ticks: {
            color: chartColors.axisText,
            font: {
              size: chartTypography.axisFontSize,
              weight: chartTypography.axisFontWeight,
            },
            maxRotation: 0,
            autoSkip: false,
          },
        },
        y: {
          min: 0,
          max: 300,
          ticks: {
            stepSize: 75,
            color: chartColors.axisText,
            font: {
              size: chartTypography.axisFontSize,
              weight: chartTypography.axisFontWeight,
            },
          },
          grid: {
            color: chartColors.grid,
            drawBorder: false,
            drawTicks: false,
            z: -1,
          },
          border: {
            display: false,
          },
        },
      },
    };

    var pointShadowPlugin = {
      id: "pointShadowPlugin",
      afterDatasetsDraw: function (chart) {
        var datasetMeta = chart.getDatasetMeta(0);

        if (!datasetMeta || !datasetMeta.data) {
          return;
        }

        var context = chart.ctx;

        datasetMeta.data.forEach(function (pointElement) {
          var pointProps = pointElement.getProps(["x", "y"], true);

          if (!isFinite(pointProps.x) || !isFinite(pointProps.y)) {
            return;
          }

          context.save();
          context.beginPath();
          context.fillStyle = chartColors.pointShadow;
          context.arc(pointProps.x, pointProps.y + 1.5, 6, 0, Math.PI * 2);
          context.fill();
          context.restore();
        });
      },
    };

    function createLineChart(canvasId, labels, data, title) {
      var canvas = document.getElementById(canvasId);

      if (!canvas) {
        return null;
      }

      return new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: title,
              data: data,
              borderColor: chartColors.primaryBlue,
              borderWidth: 4,
              borderCapStyle: "round",
              borderJoinStyle: "round",
              fill: false,
              tension: 0,
              pointRadius: 6,
              pointHoverRadius: 7,
              pointBackgroundColor: chartColors.primaryBlue,
              pointBorderColor: chartColors.primaryBlue,
              pointBorderWidth: 3,
              pointHoverBorderColor: chartColors.primaryBlue,
              pointHoverBorderWidth: 3,
              pointHoverBackgroundColor: chartColors.primaryBlue,
              spanGaps: false,
            },
          ],
        },
        options: $.extend(true, {}, commonLineChartOptions),
        plugins: [pointShadowPlugin],
      });
    }

    var uploadTrendsData = [
      20, 120, 90, 70, 50, 45, 80, 150, 180, 210, 250, 295,
    ];
    var complianceScoreTrendsData = [75, 110, 65, 150, 150, 180];

    var uploadTrendsChart = createLineChart(
      "uploadTrendsChart",
      [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      uploadTrendsData,
      "Upload Trends",
    );

    var complianceScoreChart = createLineChart(
      "complianceScoreTrendsChart",
      ["Week 01", "Week 02", "Week 03", "Week 04", "Week 05", "Week 06"],
      complianceScoreTrendsData,
      "Compliance Score Trends",
    );

    void uploadTrendsChart;
    void complianceScoreChart;
  }

  /* ===============================
       Sidebar Toggle Mode Sync
    =============================== */
  if ($(".ma-dashboard").length) {
    var $dashboard = $(".ma-dashboard");
    var $toggle = $("#aitSidebarToggle");
    var $sidebarClose = $("#maSidebarClose");
    var $sidebarOverlay = $("#maSidebarOverlay");
    var desktopBreakpoint = 1200;
    var $toggleIcon = $toggle.find("i");

    function setToggleIconState(isActive) {
      if (!$toggleIcon.length) {
        return;
      }

      $toggleIcon.removeClass("fa-bars fa-times");
      $toggleIcon.addClass(isActive ? "fa-times" : "fa-bars");
    }

    function isDesktop() {
      return $(window).width() >= desktopBreakpoint;
    }

    function closeMobileSidebar() {
      $dashboard.removeClass("is-sidebar-open");
      $("body").removeClass("ma-sidebar-open-body");
      $toggle.attr("aria-expanded", "false");
      setToggleIconState(false);
    }

    function openMobileSidebar() {
      $dashboard.addClass("is-sidebar-open");
      $("body").addClass("ma-sidebar-open-body");
      $toggle.attr("aria-expanded", "true");
      setToggleIconState(true);
    }

    function syncSidebarTooltips() {
      if (typeof bootstrap === "undefined" || !bootstrap.Tooltip) {
        return;
      }

      var shouldEnable =
        isDesktop() && $dashboard.hasClass("is-sidebar-collapsed");

      $(".ma-sidebar .ma-nav-link[data-nav-label]").each(function () {
        var label = $(this).attr("data-nav-label");
        var existingTooltip = bootstrap.Tooltip.getInstance(this);

        if (shouldEnable) {
          $(this).attr({
            "data-bs-toggle": "tooltip",
            "data-bs-placement": "right",
            "data-bs-title": label,
          });

          if (!existingTooltip) {
            new bootstrap.Tooltip(this);
          }
        } else {
          if (existingTooltip) {
            existingTooltip.dispose();
          }

          $(this).removeAttr("data-bs-toggle data-bs-placement data-bs-title");
        }
      });
    }

    function syncSidebarToggleBehavior() {
      if (!$toggle.length) {
        return;
      }

      if (isDesktop()) {
        closeMobileSidebar();
      } else {
        $dashboard.removeClass("is-sidebar-collapsed");
        setToggleIconState(false);
      }

      if (isDesktop()) {
        $toggle.attr(
          "aria-expanded",
          String(!$dashboard.hasClass("is-sidebar-collapsed")),
        );
      }

      syncSidebarTooltips();
    }

    $toggle.on("click", function (event) {
      if (isDesktop()) {
        event.preventDefault();

        $dashboard.toggleClass("is-sidebar-collapsed");

        var isCollapsed = $dashboard.hasClass("is-sidebar-collapsed");

        $toggle.attr("aria-expanded", !isCollapsed);

        setToggleIconState(isCollapsed);

        syncSidebarTooltips();
      } else {
        event.preventDefault();

        if ($dashboard.hasClass("is-sidebar-open")) {
          closeMobileSidebar();
        } else {
          openMobileSidebar();
        }
      }
    });

    $sidebarClose.on("click", function () {
      if (!isDesktop()) {
        closeMobileSidebar();
      }
    });

    $sidebarOverlay.on("click", function () {
      closeMobileSidebar();
    });

    $(".ma-sidebar .ma-nav-link").on("click", function () {
      if (!isDesktop()) {
        closeMobileSidebar();
      }
    });

    syncSidebarToggleBehavior();

    $(window).on("resize", function () {
      syncSidebarToggleBehavior();
    });
  }

  /* ===============================
       Reusable Tab Component
    =============================== */
  function initTabs() {
    $(document).on("click", ".ma-tab-button", function (e) {
      e.preventDefault();
      var $tabButton = $(this);
      var tabName = $tabButton.data("tab");

      // Remove active class from all buttons
      $tabButton.siblings(".ma-tab-button").removeClass("active");

      // Add active class to clicked button
      $tabButton.addClass("active");

      // Hide all tab panes
      $tabButton.closest(".ma-tabs").find(".tab-pane").removeClass("active");

      // Show the corresponding tab pane
      if (tabName) {
        $('div[data-tab-pane="' + tabName + '"]').addClass("active");
      }
    });
  }

  if ($(".ma-tab-button").length) {
    initTabs();
  }

  /* ===============================
       Reusable Form Validation
    =============================== */
  function initFormValidation() {
    $("form").on("submit", function (e) {
      if (!this.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      $(this).addClass("was-validated");
    });
  }

  initFormValidation();

  /* ===============================
       Reusable Pagination
    =============================== */
  function initPagination() {
    $(document).on("click", ".pagination a", function (e) {
      e.preventDefault();
      var $link = $(this);
      var $pagination = $link.closest(".pagination");

      // Remove active from all links
      $pagination.find(".page-item").removeClass("active");

      // Add active to clicked link
      $link.closest(".page-item").addClass("active");
    });
  }

  if ($(".pagination").length) {
    initPagination();
  }

  /* ===============================
       Reusable Export Functions
    =============================== */
  window.exportPDF = function () {
    alert("Exporting to PDF format...");
    // Implement PDF export logic here
  };

  window.exportExcel = function () {
    alert("Exporting to Excel format...");
    // Implement Excel export logic here
  };

  /* ===============================
       Reusable Stepper Component
    =============================== */
  function initStepper() {
    // Stepper is mainly CSS-driven with HTML classes
    // This function can be extended for dynamic step updates
    var $stepperItems = $(".stepper-item");

    $stepperItems.each(function (index) {
      var $item = $(this);

      if ($item.hasClass("completed")) {
        $item.find(".stepper-circle").html("✓");
      }
    });
  }

  if ($(".ma-stepper").length) {
    initStepper();
  }

  /* ===============================
       Reusable Badge Component
    =============================== */
  function initBadges() {
    // Badges are mainly CSS-driven
    // This function can be extended for dynamic badge updates
    var $badges = $(".status-badge, .finding-badge, .compliance-badge");

    $badges.each(function () {
      var $badge = $(this);
      var text = $badge.text().trim().toUpperCase();

      // Auto-detect badge type and apply class
      if (text === "PASS" || text.includes("PASSED")) {
        $badge.addClass("pass");
      } else if (text === "FAIL" || text.includes("FAILED")) {
        $badge.addClass("fail");
      } else if (text === "PENDING") {
        $badge.addClass("pending");
      } else if (text === "VALIDATED") {
        $badge.addClass("validated");
      }
    });
  }

  if ($(".status-badge, .finding-badge, .compliance-badge").length) {
    initBadges();
  }

  /* ===============================
       Reusable Chart Initialization
    =============================== */
  function initCharts() {
    // Chart initialization is handled per page
    // This function provides a centralized registry
    if (typeof Chart !== "undefined") {
      Chart.defaults.font.family = "'Inter', sans-serif";
      Chart.defaults.color = "#64748B";
    }
  }

  initCharts();

  /* ===============================
       Chart Initialization - Bar Charts
    =============================== */
  function initMonthlyClaimsChart() {
    if (typeof Chart === "undefined") {
      return;
    }

    var canvas = document.getElementById("monthlyClaimsChart");
    if (!canvas) {
      return;
    }

    new Chart(canvas, {
      type: "bar",
      data: {
        labels: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
        datasets: [
          {
            label: "Uploaded",
            data: [5, 4, 6, 5, 7, 6, 4, 5, 6, 7, 5, 4],
            backgroundColor: "#6A8FFF",
          },
          {
            label: "Passed",
            data: [4, 3, 5, 4, 6, 5, 3, 4, 5, 6, 4, 3],
            backgroundColor: "#AEC2FF",
          },
          {
            label: "Failed",
            data: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            backgroundColor: "#84A3FF",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  if (document.getElementById("monthlyClaimsChart")) {
    initMonthlyClaimsChart();
  }

  /* ===============================
       Claim Analyst - AI Findings Filter
    =============================== */
  function initClaimAnalystFilters() {
    var page = document.querySelector(".claim-analyst-page");

    if (!page) {
      return;
    }

    var tabButtons = page.querySelectorAll(".ma-tab-button");
    var tableRows = page.querySelectorAll(
      ".ma-findings-table tbody tr[data-priority]",
    );
    var emptyState = page.querySelector(
      ".ma-findings-table tbody .ma-empty-state",
    );

    if (!tabButtons.length) {
      return;
    }

    function filterByPriority(priority) {
      var visibleCount = 0;

      tableRows.forEach(function (row) {
        var rowPriority = row.getAttribute("data-priority");
        var show = priority === "all" || rowPriority === priority;

        row.classList.toggle("d-none", !show);

        if (show) {
          visibleCount++;
        }
      });

      if (emptyState) {
        emptyState.classList.toggle("d-none", visibleCount > 0);
      }
    }

    tabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        tabButtons.forEach(function (btn) {
          btn.classList.remove("active");
        });

        this.classList.add("active");

        var tab = this.getAttribute("data-tab");
        var priority = tab === "all-results" ? "all" : tab;

        filterByPriority(priority);
      });
    });

    filterByPriority("all");
  }

  if (document.querySelector(".claim-analyst-page")) {
    initClaimAnalystFilters();
  }

  /* ===============================
       Reports - Export Functions
    =============================== */
  function initReportsExport() {
    var exportPDFBtn = document.querySelector('[data-export="pdf"]');
    var exportExcelBtn = document.querySelector('[data-export="excel"]');

    if (exportPDFBtn) {
      exportPDFBtn.addEventListener("click", function () {
        alert("Exporting report as PDF...");
      });
    }

    if (exportExcelBtn) {
      exportExcelBtn.addEventListener("click", function () {
        alert("Exporting report as Excel...");
      });
    }
  }

  if (document.querySelector(".reports-page")) {
    initReportsExport();
  }

  /* ===============================
       Reports - All Export Buttons
    =============================== */
  if (document.querySelector(".reports-page")) {
    document
      .querySelectorAll(".reports-page [data-export]")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          var type = this.getAttribute("data-export");
          var isExcel = type.indexOf("excel") !== -1;
          alert("Exporting as " + (isExcel ? "Excel" : "PDF") + "...");
        });
      });
  }

  /* ===============================
       Upload Component - Production Ready
    =============================== */

  // Upload Configuration
  var UploadConfig = {
    maxFileSize: 25 * 1024 * 1024, // 25MB in bytes
    allowedExtensions: [
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "doc",
      "docx",
      "csv",
      "xls",
      "xlsx",
    ],
    imageExtensions: ["jpg", "jpeg", "png", "gif", "webp"],
  };

  /**
   * UploadManager - Handles all upload functionality
   * @param {string} uploadBoxId - ID of upload area
   * @param {string} fileInputId - ID of file input
   * @param {string} previewsContainerId - ID of previews container
   */
  function UploadManager(uploadBoxId, fileInputId, previewsContainerId) {
    this.uploadBox = document.getElementById(uploadBoxId);
    this.fileInput = document.getElementById(fileInputId);
    this.previewsContainer = document.getElementById(previewsContainerId);
    this.uploadedFiles = []; // Track files for internal state

    if (this.uploadBox && this.fileInput && this.previewsContainer) {
      this.init();
    }
  }

  UploadManager.prototype.init = function () {
    var self = this;

    // Click to browse
    this.uploadBox.addEventListener("click", function (e) {
      if (e.target.tagName !== "INPUT") {
        self.fileInput.click();
      }
    });

    // Drag events
    this.uploadBox.addEventListener("dragenter", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });

    this.uploadBox.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.uploadBox.classList.add("is-dragover");
    });

    this.uploadBox.addEventListener("dragleave", function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.uploadBox.classList.remove("is-dragover");
    });

    this.uploadBox.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.uploadBox.classList.remove("is-dragover");
      var files = e.dataTransfer.files;
      if (files.length) {
        self.handleFiles(files);
      }
    });

    // File input change
    this.fileInput.addEventListener("change", function () {
      if (this.files.length) {
        self.handleFiles(this.files);
      }
    });

    // Event delegation for preview card actions
    this.previewsContainer.addEventListener("click", function (e) {
      var removeBtn = e.target.closest(".ma-preview-btn-remove");
      var viewBtn = e.target.closest(".ma-preview-btn-view");
      var downloadBtn = e.target.closest(".ma-preview-btn-download");

      if (removeBtn) {
        e.preventDefault();
        var card = removeBtn.closest(".ma-preview-card");
        var fileIndex = Array.from(self.previewsContainer.children).indexOf(
          card,
        );
        self.removeFile(fileIndex);
      }

      if (viewBtn) {
        e.preventDefault();
        var fileIndex = Array.from(self.previewsContainer.children).indexOf(
          viewBtn.closest(".ma-preview-card"),
        );
        self.viewFile(fileIndex);
      }

      if (downloadBtn) {
        e.preventDefault();
        var fileIndex = Array.from(self.previewsContainer.children).indexOf(
          downloadBtn.closest(".ma-preview-card"),
        );
        self.downloadFile(fileIndex);
      }
    });
  };

  UploadManager.prototype.handleFiles = function (fileList) {
    var self = this;
    var validFiles = [];
    var errors = [];

    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      var validation = this.validateFile(file);

      if (validation.valid) {
        // Check for duplicates
        var isDuplicate = this.uploadedFiles.some(function (f) {
          return (
            f.name === file.name &&
            f.size === file.size &&
            f.lastModified === file.lastModified
          );
        });

        if (!isDuplicate) {
          validFiles.push(file);
          this.uploadedFiles.push(file);
        } else {
          errors.push(file.name + " (duplicate)");
        }
      } else {
        errors.push(file.name + " - " + validation.error);
      }
    }

    // Show errors if any
    if (errors.length > 0) {
      this.showValidationError(errors.join("\n"));
    }

    // Add preview cards for valid files
    validFiles.forEach(function (file) {
      self.addPreviewCard(file);
    });

    // Update file input using DataTransfer
    this.updateFileInput();
  };

  UploadManager.prototype.validateFile = function (file) {
    var extension = file.name.split(".").pop().toLowerCase();

    // Check extension
    if (UploadConfig.allowedExtensions.indexOf(extension) === -1) {
      return {
        valid: false,
        error:
          "Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX, CSV, XLS, XLSX",
      };
    }

    // Check file size
    if (file.size > UploadConfig.maxFileSize) {
      return {
        valid: false,
        error: "File size exceeds 25MB limit",
      };
    }

    return { valid: true };
  };

  UploadManager.prototype.addPreviewCard = function (file) {
    var self = this;
    var fileType = this.getFileType(file);
    var fileSizeMB = (file.size / 1048576).toFixed(1);
    var truncatedName = this.truncateFileName(file.name, 30);

    var card = document.createElement("div");
    card.className = "ma-preview-card";
    card.innerHTML =
      '\
            <div class="ma-preview-thumbnail" id="thumbnail-' +
      Math.random().toString(36).substr(2, 9) +
      '">\
                ' +
      this.getLoadingIcon() +
      '\
            </div>\
            <div class="ma-preview-info">\
                <div class="ma-preview-name" title="' +
      this.escapeHtml(file.name) +
      '">' +
      this.escapeHtml(truncatedName) +
      '</div>\
                <div class="ma-preview-size">' +
      fileSizeMB +
      ' MB</div>\
                <div class="ma-preview-status">Uploaded</div>\
            </div>\
            <div class="ma-preview-actions">\
                ' +
      (fileType === "image"
        ? '<button type="button" class="ma-preview-btn-view" title="View file" aria-label="View file"><i class="fa-solid fa-eye"></i></button>'
        : "") +
      "\
                " +
      (fileType === "pdf"
        ? '<button type="button" class="ma-preview-btn-view" title="View file" aria-label="View file"><i class="fa-solid fa-eye"></i></button>'
        : "") +
      '\
                <button type="button" class="ma-preview-btn-download" title="Download file" aria-label="Download file"><i class="fa-solid fa-download"></i></button>\
                <button type="button" class="ma-preview-btn-remove" title="Remove file" aria-label="Remove file"><i class="fa-solid fa-trash"></i></button>\
            </div>\
        ';

    this.previewsContainer.appendChild(card);

    // Load preview based on file type
    if (fileType === "image") {
      this.loadImagePreview(file, card);
    } else if (fileType === "pdf") {
      this.loadPdfPreview(file, card);
    } else {
      this.loadDocumentIcon(file, card);
    }
  };

  UploadManager.prototype.loadImagePreview = function (file, card) {
    var thumbnail = card.querySelector(".ma-preview-thumbnail");
    var reader = new FileReader();

    reader.onload = function (e) {
      thumbnail.innerHTML =
        '<img src="' +
        e.target.result +
        '" alt="' +
        this.escapeHtml(file.name) +
        '" />';
    }.bind(this);

    reader.onerror = function () {
      thumbnail.innerHTML =
        '<i class="fa-solid fa-image ma-preview-file-icon ma-icon-image"></i>';
    };

    reader.readAsDataURL(file);
  };

  UploadManager.prototype.loadPdfPreview = function (file, card) {
    var thumbnail = card.querySelector(".ma-preview-thumbnail");
    thumbnail.innerHTML =
      '<i class="fa-solid fa-file-pdf ma-preview-file-icon ma-icon-pdf"></i>';
  };

  UploadManager.prototype.loadDocumentIcon = function (file, card) {
    var thumbnail = card.querySelector(".ma-preview-thumbnail");
    var extension = file.name.split(".").pop().toLowerCase();
    var iconClass =
      ["doc", "docx"].indexOf(extension) !== -1 ? "ma-icon-doc" : "";
    thumbnail.innerHTML =
      '<i class="fa-solid fa-file ma-preview-file-icon ' + iconClass + '"></i>';
  };

  UploadManager.prototype.removeFile = function (fileIndex) {
    if (fileIndex >= 0 && fileIndex < this.uploadedFiles.length) {
      // Remove from internal array
      this.uploadedFiles.splice(fileIndex, 1);

      // Remove card from DOM
      var cards = this.previewsContainer.querySelectorAll(".ma-preview-card");
      if (cards[fileIndex]) {
        cards[fileIndex].remove();
      }

      // Update file input
      this.updateFileInput();
    }
  };

  UploadManager.prototype.updateFileInput = function () {
    var dataTransfer = new DataTransfer();

    for (var i = 0; i < this.uploadedFiles.length; i++) {
      dataTransfer.items.add(this.uploadedFiles[i]);
    }

    this.fileInput.files = dataTransfer.files;
  };

  UploadManager.prototype.viewFile = function (fileIndex) {
    if (fileIndex >= 0 && fileIndex < this.uploadedFiles.length) {
      var file = this.uploadedFiles[fileIndex];
      var fileType = this.getFileType(file);

      if (fileType === "image") {
        this.viewImageFile(file);
      } else if (fileType === "pdf") {
        this.viewPdfFile(file);
      }
    }
  };

  UploadManager.prototype.downloadFile = function (fileIndex) {
    if (fileIndex >= 0 && fileIndex < this.uploadedFiles.length) {
      var file = this.uploadedFiles[fileIndex];
      var url = URL.createObjectURL(file);
      var link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  UploadManager.prototype.viewImageFile = function (file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.src = e.target.result;
      var w = window.open("");
      w.document.write(img.outerHTML);
    };
    reader.readAsDataURL(file);
  };

  UploadManager.prototype.viewPdfFile = function (file) {
    var url = URL.createObjectURL(file);
    window.open(url);
  };

  UploadManager.prototype.getFileType = function (file) {
    var extension = file.name.split(".").pop().toLowerCase();

    if (UploadConfig.imageExtensions.indexOf(extension) !== -1) {
      return "image";
    } else if (extension === "pdf") {
      return "pdf";
    } else if (["doc", "docx"].indexOf(extension) !== -1) {
      return "document";
    } else {
      return "file";
    }
  };

  UploadManager.prototype.truncateFileName = function (name, maxLength) {
    if (name.length <= maxLength) {
      return name;
    }

    var extension = "." + name.split(".").pop();
    var nameWithoutExt = name.substring(0, name.lastIndexOf("."));
    var remaining = maxLength - extension.length - 3;

    return (
      nameWithoutExt.substring(0, Math.max(remaining, 5)) + "..." + extension
    );
  };

  UploadManager.prototype.escapeHtml = function (text) {
    var map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  };

  UploadManager.prototype.showValidationError = function (message) {
    // Create and show error message
    var errorDiv = document.createElement("div");
    errorDiv.className = "ma-upload-error";
    errorDiv.innerHTML =
      "<strong>Invalid files:</strong><br>" +
      this.escapeHtml(message).replace(/\n/g, "<br>");

    // Insert after upload box
    this.uploadBox.parentNode.insertBefore(
      errorDiv,
      this.uploadBox.nextSibling,
    );

    // Auto-remove after 5 seconds
    setTimeout(function () {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  };

  UploadManager.prototype.getLoadingIcon = function () {
    return '<i class="fa-solid fa-file ma-preview-file-icon"></i>';
  };

  // Initialize upload managers for validate-claim page
  if (document.querySelector(".validate-claim-page")) {
    new UploadManager(
      "treatmentPlanUpload",
      "treatmentPlanFile",
      "treatmentPlanPreviews",
    );
    new UploadManager(
      "clinicalNotesUpload",
      "clinicalNotesFile",
      "clinicalNotesPreviews",
    );
    new UploadManager("dla20Upload", "dla20File", "dla20Previews");
  }

  if (document.getElementById("claimDataUpload")) {
    new UploadManager("claimDataUpload", "claimDataFile", "claimDataPreviews");
  }

  /* ===============================
       Responsive Table Labels
    =============================== */
  function initResponsiveTableLabels() {
    document.querySelectorAll(".ma-data-table").forEach(function (table) {
      var headers = Array.prototype.slice
        .call(table.querySelectorAll("thead th"))
        .map(function (th) {
          return (th.textContent || "").trim();
        });

      if (!headers.length) {
        return;
      }

      table.querySelectorAll("tbody tr").forEach(function (row) {
        row.querySelectorAll("td").forEach(function (cell, index) {
          if (!cell.hasAttribute("data-label") && headers[index]) {
            cell.setAttribute("data-label", headers[index]);
          }
        });
      });
    });
  }

  initResponsiveTableLabels();

  /* ===============================
       Managed Table Component
    =============================== */
  function initManagedTables() {
    var managedTables = document.querySelectorAll(".ma-managed-table[id]");

    if (!managedTables.length) {
      return;
    }

    managedTables.forEach(function (table) {
      var tableSelector = "#" + table.id;
      var tbody = table.querySelector("tbody");

      if (!tbody) {
        return;
      }

      var tableRows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
      var searchInput = document.querySelector(
        '[data-ma-table-search="true"][data-ma-table-target="' +
          tableSelector +
          '"]',
      );
      var rowsSelect = document.querySelector(
        '[data-ma-table-rows="true"][data-ma-table-target="' +
          tableSelector +
          '"]',
      );
      var pagination = document.querySelector(
        '[data-ma-table-pagination="true"][data-ma-table-target="' +
          tableSelector +
          '"]',
      );
      var filterSelects = document.querySelectorAll(
        '[data-ma-filter-key][data-ma-table-target="' + tableSelector + '"]',
      );
      var dateFromInput = document.querySelector(
        '[data-ma-date-from][data-ma-table-target="' + tableSelector + '"]',
      );
      var dateToInput = document.querySelector(
        '[data-ma-date-to][data-ma-table-target="' + tableSelector + '"]',
      );

      var state = {
        page: 1,
        perPage: rowsSelect ? parseInt(rowsSelect.value, 10) || 4 : 4,
        sortKey: null,
        sortDirection: "asc",
      };

      function parseDate(value) {
        if (!value) {
          return null;
        }

        var parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      function matchSearch(row, keyword) {
        if (!keyword) {
          return true;
        }

        return row.textContent.toLowerCase().indexOf(keyword) !== -1;
      }

      function matchFilters(row) {
        var isMatched = true;

        filterSelects.forEach(function (select) {
          var filterKey = select.getAttribute("data-ma-filter-key");
          var selectedValue = (select.value || "").toLowerCase();
          var rowValue = (
            row.getAttribute(
              "data-" +
                filterKey.replace(/[A-Z]/g, function (letter) {
                  return "-" + letter.toLowerCase();
                }),
            ) || ""
          ).toLowerCase();

          if (
            selectedValue &&
            selectedValue !== "all" &&
            rowValue !== selectedValue
          ) {
            isMatched = false;
          }
        });

        return isMatched;
      }

      function matchDateRange(row) {
        var fromKey = dateFromInput
          ? dateFromInput.getAttribute("data-ma-date-from")
          : null;
        var toKey = dateToInput
          ? dateToInput.getAttribute("data-ma-date-to")
          : null;
        var key = fromKey || toKey;

        if (!key) {
          return true;
        }

        var rowDateValue = row.getAttribute(
          "data-" +
            key.replace(/[A-Z]/g, function (letter) {
              return "-" + letter.toLowerCase();
            }),
        );
        var rowDate = parseDate(rowDateValue);

        if (!rowDate) {
          return true;
        }

        var fromDate = dateFromInput ? parseDate(dateFromInput.value) : null;
        var toDate = dateToInput ? parseDate(dateToInput.value) : null;

        if (fromDate && rowDate < fromDate) {
          return false;
        }

        if (toDate && rowDate > toDate) {
          return false;
        }

        return true;
      }

      function sortRows(rows) {
        if (!state.sortKey) {
          return rows;
        }

        var attributeKey =
          "data-" +
          state.sortKey.replace(/[A-Z]/g, function (letter) {
            return "-" + letter.toLowerCase();
          });

        rows.sort(function (a, b) {
          var aVal = a.getAttribute(attributeKey) || "";
          var bVal = b.getAttribute(attributeKey) || "";

          var aNumber = parseFloat(aVal);
          var bNumber = parseFloat(bVal);
          var bothNumbers = !isNaN(aNumber) && !isNaN(bNumber);

          var compare = bothNumbers
            ? aNumber - bNumber
            : String(aVal).localeCompare(String(bVal), undefined, {
                numeric: true,
                sensitivity: "base",
              });

          return state.sortDirection === "asc" ? compare : -compare;
        });

        return rows;
      }

      function renderPagination(totalRows) {
        if (!pagination) {
          return;
        }

        pagination.innerHTML = "";

        var totalPages = Math.max(1, Math.ceil(totalRows / state.perPage));

        if (state.page > totalPages) {
          state.page = totalPages;
        }

        for (var i = 1; i <= totalPages; i++) {
          var li = document.createElement("li");
          li.className = "page-item" + (i === state.page ? " active" : "");

          var a = document.createElement("a");
          a.className = "page-link";
          a.href = "#";
          a.textContent = i;
          a.setAttribute("data-ma-page", String(i));

          li.appendChild(a);
          pagination.appendChild(li);
        }
      }

      function render() {
        var keyword = searchInput
          ? (searchInput.value || "").toLowerCase().trim()
          : "";

        var filteredRows = tableRows.filter(function (row) {
          return (
            matchSearch(row, keyword) &&
            matchFilters(row) &&
            matchDateRange(row)
          );
        });

        filteredRows = sortRows(filteredRows);

        var totalRows = filteredRows.length;
        var totalPages = Math.max(1, Math.ceil(totalRows / state.perPage));

        if (state.page > totalPages) {
          state.page = totalPages;
        }

        var start = (state.page - 1) * state.perPage;
        var end = start + state.perPage;

        tableRows.forEach(function (row) {
          row.style.display = "none";
        });

        filteredRows.slice(start, end).forEach(function (row) {
          row.style.display = "";
        });

        renderPagination(totalRows);
      }

      if (searchInput) {
        searchInput.addEventListener("input", function () {
          state.page = 1;
          render();
        });
      }

      if (rowsSelect) {
        rowsSelect.addEventListener("change", function () {
          state.perPage = parseInt(rowsSelect.value, 10) || 4;
          state.page = 1;
          render();
        });
      }

      filterSelects.forEach(function (select) {
        select.addEventListener("change", function () {
          state.page = 1;
          render();
        });
      });

      if (dateFromInput) {
        dateFromInput.addEventListener("change", function () {
          state.page = 1;
          render();
        });
      }

      if (dateToInput) {
        dateToInput.addEventListener("change", function () {
          state.page = 1;
          render();
        });
      }

      if (pagination) {
        pagination.addEventListener("click", function (event) {
          var link = event.target.closest("a[data-ma-page]");

          if (!link) {
            return;
          }

          event.preventDefault();
          state.page = parseInt(link.getAttribute("data-ma-page"), 10) || 1;
          render();
        });
      }

      table
        .querySelectorAll("thead th[data-ma-sort-key]")
        .forEach(function (headerCell) {
          headerCell.style.cursor = "pointer";

          headerCell.addEventListener("click", function () {
            var key = headerCell.getAttribute("data-ma-sort-key");

            if (!key) {
              return;
            }

            if (state.sortKey === key) {
              state.sortDirection =
                state.sortDirection === "asc" ? "desc" : "asc";
            } else {
              state.sortKey = key;
              state.sortDirection = "asc";
            }

            state.page = 1;
            render();
          });
        });

      render();
    });
  }

  initManagedTables();

  /* ===============================
       Form Submission Handling
    =============================== */
  // $(document).on("submit", ".ma-validate-form", function (e) {
  //   e.preventDefault();
  //   alert("Claim validation submitted successfully!");
  //   // In production, send AJAX request here
  // });

  /* ===============================
       Back Button Navigation
    =============================== */
  // $(document).on("click", ".ma-btn-back", function (e) {
  //   e.preventDefault();
  //   window.history.back();
  // });

  /* ===============================
       Claim Detail Review Submission
    =============================== */
  // window.submitReview = function () {
  //   var notes = document.getElementById("maReviewNotes")
  //     ? document.getElementById("maReviewNotes").value
  //     : "";
  //   var status = document.getElementById("maReviewStatus")
  //     ? document.getElementById("maReviewStatus").value
  //     : "";
  //   alert("Review submitted!\nStatus: " + status + "\nNotes: " + notes);
  //   // In production, send AJAX request here
  // };
});
